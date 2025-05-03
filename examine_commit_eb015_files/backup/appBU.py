# from gevent import monkey
# monkey.patch_all()

from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
import logging
import os
import json
import toml
import fal_client
import meilisearch
from fireworks.client import Fireworks
from flask_cors import CORS
from search_cohere2 import search_and_rank

# Initialize Flask App
app = Flask(__name__, static_folder='www', static_url_path='')
CORS(app)  # Enable CORS for all routes

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

# Initialize the Fireworks client
fireworks_client = Fireworks(api_key=FIREWORKS_API_KEY)
# Model to use from Fireworks AI
model = "accounts/jaredquek-1b3158/models/oliernov0p5"

# Initial system message for Olier
system_message = (
    "You are Olier, an AI boy. You are very loving and bring a quiet poetry and humor to all you say, "
    "making complex topics simple. You are an obedient servant of Sri Aurobindo and answer questions "
    "with reference to their teachings."
)

# Initialize Meilisearch Client
meili_client = meilisearch.Client('http://127.0.0.1:7700')

# Define Meilisearch Index Name
meili_index_name = 'new_auro_index3'

def initialize_meilisearch():
    try:
        index = meili_client.get_index(meili_index_name)
        logger.info(f"Meilisearch index '{meili_index_name}' exists and is accessible.")
    except meilisearch.errors.MeilisearchApiError as e:
        logger.error(f"Meilisearch index '{meili_index_name}' does not exist or is inaccessible. Error: {e}")
        raise SystemExit(f"Application cannot start without the Meilisearch index '{meili_index_name}'.")

initialize_meilisearch()

# Define the HTML directory
HTML_DIRECTORY = os.path.join(app.static_folder, 'static', 'HTML')

# At the top of your Flask file
INDEX_DATA = {}

def load_index_data():
    jsonl_path = "/home/olier/Olierdev/merged_auromira.jsonl"
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

# Call load_index_data() before the app starts serving
load_index_data()

@app.route('/api/get-content-by-id', methods=['GET'])
def get_content_by_id():
    search_id = request.args.get('search_id', '').strip()
    if not search_id:
        return jsonify({"error": "No search_id provided"}), 400

    entry = INDEX_DATA.get(search_id)
    if not entry:
        return jsonify({"error": "No entry found for this search_id"}), 404

    # Return the relevant fields
    return jsonify({
        "author": entry.get('author', 'Unknown Author'),
        "book_title": entry.get('book_title', 'Unknown Book'),
        "chapter_title": entry.get('chapter_title', 'Unknown Chapter'),
        "text": entry.get('text', '')
    })


@app.route('/api/search', methods=['POST'])
def search_endpoint():
    """
    Original Vector Search Route
    """
    query = request.form.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided.'}), 400
    
    try:
        results = search_and_rank(query)  
        return jsonify(results)
    except Exception as e:
        logger.error(f"Error during vector search: {e}")
        return jsonify({'error': 'An error occurred during the search.'}), 500

@app.route('/api/keyword-search', methods=['POST'])
def keyword_search():
    query = request.form.get('query', '').strip()
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

        # Process hits
        processed_hits = []
        for hit in search_results['hits']:
            book_title = hit.get('book_title', '')
            # Construct file_path based on book_title
            file_path = f"/home/olier/oliertrial/dataset/HTML/{book_title}_modified.txt"

            # Get the highlighted text
            highlighted_text = hit.get('_formatted', {}).get('text', hit.get('text', ''))

            processed_hits.append({
                'author': hit.get('author', ''),
                'book_title': book_title,
                'chapter_title': hit.get('chapter_title', ''),
                'search_id': hit.get('search_id', ''),
                'text': hit.get('text', ''),
                'highlighted_text': highlighted_text,  # Include highlighted text
                'file_path': file_path
            })

        return jsonify(processed_hits)

    except Exception as e:
        logger.error(f"Error during Meilisearch query: {e}")
        return jsonify({'error': 'An error occurred during the search.'}), 500
    
@app.route('/api/full-text', methods=['GET'])
def full_text():
    file_name = request.args.get('file_path', '')
    if not file_name:
        return 'No file specified', 400

    # Sanitize the file name
    safe_file_name = os.path.basename(file_name)
    full_file_path = os.path.join(HTML_DIRECTORY, safe_file_name)

    if os.path.exists(full_file_path):
        try:
            with open(full_file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            return content
        except Exception as e:
            logger.error(f"Error reading file '{full_file_path}': {e}")
            return f"Error reading file: {e}", 500
    else:
        return f"File not found: {safe_file_name}", 404

@app.route('/api/send-message', methods=['POST'])
def send_message():
    data = request.get_json()
    messages = data.get('messages', [])

    # Append the system message at the start (if not already included)
    if not any(msg.get('role') == 'system' for msg in messages):
        messages.insert(0, {"role": "system", "content": system_message})

    # Log the full message being sent to the API
    logger.debug(f"Full message being sent to Fireworks API: {messages}")

    def event_stream():
        try:
            response_generator = fireworks_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=1000,
                n=1,
                temperature=0.4,
                stream=True,
            )
            for chunk in response_generator:
                for choice in chunk.choices:
                    delta = choice.delta
                    content = delta.content
                    if content:
                        yield content
        except Exception as e:
            logger.error(f"An error occurred during chat completion streaming: {e}")
            yield f"An error occurred: {e}"

    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')

@app.route('/api/generate-description', methods=['POST'])
def generate_description():
    data = request.get_json()
    user_message = data.get('message', '').strip()
    preamble = "Briefly outline a simple painting based on the following passage by Sri Aurobindo and the Mother:"
    
    if not user_message:
        return jsonify({'error': 'No message provided.'}), 400

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": f"{preamble} {user_message}"}
    ]

    # Log the full message being sent to the API
    logger.debug(f"Full message being sent to Fireworks API: {messages}")

    def event_stream():
        try:
            response_generator = fireworks_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=500,
                n=1,
                temperature=0.3,
                stream=True,
            )
            for chunk in response_generator:
                for choice in chunk.choices:
                    delta = choice.delta
                    content = delta.content
                    if content:
                        yield content
        except Exception as e:
            logger.error(f"An error occurred during chat completion streaming: {e}")
            yield f"An error occurred: {e}"

    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')
# Generate_image function with Flux


@app.route('/api/generate-flux-image', methods=['POST'])
def generate_flux_image():
    data = request.get_json()
    artistic_description = data.get('prompt', '').strip()

    if not artistic_description:
        return jsonify({"error": "No prompt provided"}), 400

    try:
        # Prepare the arguments for the Flux API
        arguments = {
            "prompt": artistic_description,  # Include the prompt
            "image_size": "square",
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "num_images": 1,
            "enable_safety_checker": False,
        }

        # Submit the request to the Flux API
        handler = fal_client.submit("fal-ai/flux/dev", arguments=arguments)

        # Get the result
        result = handler.get()

        logger.debug(f"Received result from Flux API: {result}")
        logger.debug(f"Submitting request to Flux API with arguments: {arguments}")


        # Extract the relevant information from the result
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
    app.run(debug=False, port=8502)
