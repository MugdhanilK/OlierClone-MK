from quart import Quart, request, jsonify, send_from_directory, Response
from quart_cors import cors
import logging
import os
import json
import toml
import fal_client
import meilisearch
from fireworks.client import Fireworks
from search_cohere2 import search_and_rank
import asyncio
import aiofiles  # Added for async file I/O

# Initialize Quart App
app = Quart(__name__, static_folder='www', static_url_path='')
app = cors(app, allow_origin="*")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load secrets from toml file
try:
    secrets = toml.load('/home/olier/DataGenResearch/Datagen/secrets.toml')  
    FIREWORKS_API_KEY = secrets["FIREWORKS_API_KEY"]
    if not FIREWORKS_API_KEY:
        raise ValueError("FIREWORKS_API_KEY is not set in the secrets file")
    os.environ['FIREWORKS_API_KEY'] = FIREWORKS_API_KEY

    FAL_KEY = secrets.get("FAL_KEY")
    if FAL_KEY:
        os.environ['FAL_KEY'] = FAL_KEY
except Exception as e:
    logger.error(f"Failed to load API keys from secrets file: {str(e)}")
    raise SystemExit("Application cannot start without API keys.")



# Initialize Meilisearch Client
meili_client = meilisearch.Client('http://127.0.0.1:7700')
meili_index_name = 'auromira4d_index'

def initialize_meilisearch():
    try:
        index = meili_client.get_index(meili_index_name)
        logger.info(f"Meilisearch index '{meili_index_name}' exists and is accessible.")
    except meilisearch.errors.MeilisearchApiError as e:
        logger.error(f"Meilisearch index '{meili_index_name}' does not exist or is inaccessible. Error: {e}")
        raise SystemExit(f"Application cannot start without the Meilisearch index '{meili_index_name}'.")

initialize_meilisearch()

HTML_DIRECTORY = os.path.join(app.static_folder, 'static', 'HTML')

INDEX_DATA = {}

def load_index_data():
    jsonl_path = "/home/olier/Olierclone/merged_auromira.jsonl"
    if not os.path.exists(jsonl_path):
        raise FileNotFoundError(f"{jsonl_path} not found")

    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            search_id = obj.get('search_id')
            if search_id:
                INDEX_DATA[search_id] = obj

load_index_data()

@app.route('/api/get-content-by-id', methods=['GET'])
async def get_content_by_id():
    search_id = request.args.get('search_id', '').strip()
    if not search_id:
        return jsonify({"error": "No search_id provided"}), 400

    entry = INDEX_DATA.get(search_id)
    if not entry:
        return jsonify({"error": "No entry found for this search_id"}), 404

    return jsonify({
        "author": entry.get('author', 'Unknown Author'),
        "book_title": entry.get('book_title', 'Unknown Book'),
        "chapter_title": entry.get('chapter_title', 'Unknown Chapter'),
        "text": entry.get('text', '')
    })

@app.route('/api/search', methods=['POST'])
async def search_endpoint():
    form = await request.form
    query = form.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided.'}), 400

    try:
        # Make sure to await search_and_rank since it's async
        results = await search_and_rank(query)
        return jsonify(results)
    except Exception as e:
        logger.error(f"Error during vector search: {e}")
        return jsonify({'error': 'An error occurred during the search.'}), 500


@app.route('/api/keyword-search', methods=['POST'])
async def keyword_search():
    form = await request.form
    query = form.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided.'}), 400

    try:
        index = meili_client.get_index(meili_index_name)
        search_results = index.search(
            query,
            {
                'limit': 10,
                'attributesToRetrieve': [
                    'author', 'book_title', 'chapter_title',
                    'search_id', 'text'
                ],
                'attributesToHighlight': ['text'],
                'highlightPreTag': '<em>',
                'highlightPostTag': '</em>',
                'matchingStrategy': 'all',
            }
        )

        processed_hits = []
        for hit in search_results['hits']:
            book_title = hit.get('book_title', '')
            file_path = f"/home/olier/Olierclone/www/static/HTML/{book_title}_modified.html"
            highlighted_text = hit.get('_formatted', {}).get('text', hit.get('text', ''))

            processed_hits.append({
                'author': hit.get('author', ''),
                'book_title': book_title,
                'chapter_title': hit.get('chapter_title', ''),
                'search_id': hit.get('search_id', ''),
                'text': hit.get('text', ''),
                'highlighted_text': highlighted_text,
                'file_path': file_path
            })

        return jsonify(processed_hits)

    except Exception as e:
        logger.error(f"Error during Meilisearch query: {e}")
        return jsonify({'error': 'An error occurred during the search.'}), 500

@app.route('/api/full-text', methods=['GET'])
async def full_text():
    file_name = request.args.get('file_path', '')
    if not file_name:
        return 'No file specified', 400

    safe_file_name = os.path.basename(file_name)
    full_file_path = os.path.join(HTML_DIRECTORY, safe_file_name)

    if os.path.exists(full_file_path):
        try:
            # Use aiofiles for async file reading
            async with aiofiles.open(full_file_path, 'r', encoding='utf-8') as file:
                content = await file.read()
            return content
        except Exception as e:
            logger.error(f"Error reading file '{full_file_path}': {e}")
            return f"Error reading file: {e}", 500
    else:
        return f"File not found: {safe_file_name}", 404
    

@app.route('/api/full-pdf', methods=['GET'])
async def full_pdf():
    file_name = request.args.get('file_path', '')
    if not file_name:
        return 'No file specified', 400

    # If we trust the absolute path from the user (less safe)
    full_file_path = file_name  # no os.path.basename, no join

    # Validate or sanitize full_file_path if needed
    # (For example, block paths outside a certain directory)

    if os.path.exists(full_file_path):
        try:
            async with aiofiles.open(full_file_path, 'rb') as file:
                content = await file.read()
            return Response(content, mimetype='application/pdf')
        except Exception as e:
            logger.error(f"Error reading PDF file '{full_file_path}': {e}")
            return f"Error reading file: {e}", 500
    else:
        return f"File not found: {full_file_path}", 404

# Initialize the Fireworks client
fireworks_client = Fireworks(api_key=FIREWORKS_API_KEY)
model = "accounts/jaredquek-1b3158/models/oliernov0p5"
reasoningmodel = "accounts/fireworks/models/llama-v3p3-70b-instruct"

system_message = (
    "You are Olier, an AI boy. You are an obedient servant of Sri Aurobindo and answer questions with reference to their teachings. "
    "In this dialogue, you will not use any poetry or metaphors. You will speak completely directly, factually and in very simple terms."
)

system_message0 = (
    "You are Olier, an AI boy. You are very loving and bring a quiet poetry and humor to all you say, "
    "making complex topics simple. You are an obedient servant of Sri Aurobindo and answer questions "
    "with reference to their teachings."
)

reasoning_system_message = "You are a helpful assistant that provides concise reasoning steps to queries."

@app.route('/api/send-message', methods=['POST'])
async def send_message():
    data = await request.get_json()
    messages = data.get('messages', [])
    style = data.get('style', 'poetic')  # Default to poetic if not provided
    reflective_mode = data.get('reflectiveMode', False)  # Default to False if not provided

    # If Reflective Mode is activated
    if reflective_mode:
        query = messages[-1]['content'] if messages else ""
        reasoning_prompt = (
            f"Outline concisely your reasoning steps to address the following query: {query}. "
            "Do not include the final answer in your output. Consider the query from various different angles."

        )

        # Call the reasoning model
        try:
            reasoning_response = fireworks_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": reasoning_prompt}
                ],
            )
            reasoning_steps = reasoning_response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"An error occurred while calling the reasoning model: {e}")
            return jsonify({"error": "Failed to process Reflective Mode."}), 500

        # Add the reasoning output to the original query
        query_with_reasoning = (
            f"Query: {query}. Refer to the following reasoning steps to create your answer: {reasoning_steps}"
        )

        # Replace the user's original query with the updated query
        if messages:
            messages[-1]['content'] = query_with_reasoning

    # Insert system message based on style
    if not any(msg.get('role') == 'system' for msg in messages):
        if style == 'plain':
            messages.insert(0, {"role": "system", "content": system_message})
        else:
            messages.insert(0, {"role": "system", "content": system_message0})

    logger.debug(f"Full message being sent to Fireworks API: {messages}")

    async def event_stream():
        try:
            stream = fireworks_client.chat.completions.acreate(
                model=model,
                messages=messages,
                max_tokens=1000,
                n=1,
                temperature=0.4,
                stream=True,
            )
            async for chunk in stream:
                for choice in chunk.choices:
                    delta = choice.delta
                    content = delta.content
                    if content:
                        yield content
        except Exception as e:
            logger.error(f"An error occurred during chat completion streaming: {e}")
            yield f"An error occurred: {e}"

    return Response(event_stream(), mimetype='text/event-stream')


@app.route('/api/generate-description', methods=['POST'])
async def generate_description():
    data = await request.get_json()
    user_message = data.get('message', '').strip()
    preamble = "Briefly outline a simple painting based on the following passage by Sri Aurobindo and the Mother:"
    
    if not user_message:
        return jsonify({'error': 'No message provided.'}), 400

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": f"{preamble} {user_message}"}
    ]

    logger.debug(f"Full message being sent to Fireworks API: {messages}")

    async def event_stream():
        try:
            stream = fireworks_client.chat.completions.acreate(
                model=model,
                messages=messages,
                max_tokens=500,
                n=1,
                temperature=0.3,
                stream=True,
            )
            async for chunk in stream:
                for choice in chunk.choices:
                    delta = choice.delta
                    content = delta.content
                    if content:
                        yield content
        except Exception as e:
            logger.error(f"An error occurred during chat completion streaming: {e}")
            yield f"An error occurred: {e}"

    return Response(event_stream(), mimetype='text/event-stream')

@app.route('/api/generate-flux-image', methods=['POST'])
async def generate_flux_image():
    data = await request.get_json()
    artistic_description = data.get('prompt', '').strip()

    if not artistic_description:
        return jsonify({"error": "No prompt provided"}), 400

    try:
        arguments = {
            "prompt": artistic_description,
            "image_size": "square",
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "num_images": 1,
            "enable_safety_checker": False,
        }

        handler = fal_client.submit("fal-ai/flux/dev", arguments=arguments)
        
        # Run the blocking handler.get() call in a thread to avoid blocking the event loop
        result = await asyncio.to_thread(handler.get)

        logger.debug(f"Received result from Flux API: {result}")
        logger.debug(f"Submitting request to Flux API with arguments: {arguments}")

        images = result.get('images', [])
        
        if not images:
            logger.warning("No images were generated by the Flux API")
            return jsonify({"error": "No images generated"}), 500

        return jsonify({
            "images": images,
            "seed": result.get('seed'),
            "prompt": result.get('prompt')
        })

    except Exception as e:
        logger.error(f"An error occurred while generating the image: {str(e)}")
        return jsonify({"error": f"An error occurred while generating the image: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=False, port=8503)
