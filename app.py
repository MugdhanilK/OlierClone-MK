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
from google import genai
from google.genai import types

# Initialize Quart App
app = Quart(__name__, static_folder='www', static_url_path='')
app = cors(app, allow_origin="*")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# --- Configuration ---
# Load secrets from TOML file instead of environment variables
SECRETS_FILE_PATH = '/home/olier/DataGenResearch/Datagen/secrets.toml' # Define path
try:
    secrets = toml.load(SECRETS_FILE_PATH)

    # Load Google API Key
    GOOGLE_API_KEY = secrets.get("GOOGLE_API_KEY")
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set in the secrets file")
    # Initialize the Gemini client instance passing the key directly
    # Removed genai.configure() as it's not used with this import/client pattern
    gemini_client = genai.Client(api_key=GOOGLE_API_KEY)
    logger.info("Google Gemini API Key loaded and client initialized.")

    # Load Fireworks API Key
    FIREWORKS_API_KEY = secrets.get("FIREWORKS_API_KEY")
    if not FIREWORKS_API_KEY:
        raise ValueError("FIREWORKS_API_KEY is not set in the secrets file")
    # Initialize Fireworks client directly with the key
    fireworks_client = Fireworks(api_key=FIREWORKS_API_KEY)
    logger.info("Fireworks API Key loaded and client initialized.")

# Handle errors during TOML loading or key retrieval
except FileNotFoundError:
    logger.error(f"Secrets file not found at: {SECRETS_FILE_PATH}")
    exit(f"Secrets file not found: {SECRETS_FILE_PATH}")
except Exception as e:
    logger.error(f"Failed to load API keys from secrets file '{SECRETS_FILE_PATH}': {str(e)}")
    exit("Application cannot start without API keys loaded correctly from TOML.")



# Initialize Meilisearch Client
meili_client = meilisearch.Client('http://127.0.0.1:7700')
meili_index_name = 'auromira4F_index'

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
    """Handles vector search requests, now accepting a 'scope' parameter."""
    try:
        form = await request.form
        query = form.get('query', '').strip()
        # Get scope from form data, default to 'all', convert to lowercase
        scope = form.get('scope', 'all').strip().lower()

        # --- Input Validation ---
        if not query:
            logger.warning("Search request received with no query.")
            return jsonify({'error': 'No query provided.'}), 400

        # Validate scope parameter
        valid_scopes = ['all', 'mother', 'aurobindo']
        if scope not in valid_scopes:
             logger.warning(f"Invalid scope '{scope}' received, defaulting to 'all'.")
             scope = 'all' # Default to 'all' if scope is invalid
        # --- End Input Validation ---

        logger.info(f"Performing vector search for query: '{query}' with scope: '{scope}'")

        # Call the updated search_and_rank function, passing the scope
        results = await search_and_rank(query, scope=scope) # Pass scope here

        logger.info(f"Search completed. Returning {len(results)} results.")
        return jsonify(results)

    except Exception as e:
        # Log the full error for debugging
        logger.error(f"Error during vector search endpoint execution: {e}", exc_info=True)
        # Return a generic error message to the client
        return jsonify({'error': 'An error occurred during the search.'}), 500



#New Keyword Search*/
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
            # Extract metadata
            author = hit.get('author', 'Unknown Author').strip()
            book_title = hit.get('book_title', 'Unknown Book').strip()
            chapter_title = hit.get('chapter_title', 'Unknown Chapter').strip()
            # Determine prefix based on author
            if author.lower() == "sri aurobindo":
                prefix = "CWSA"
            elif author.lower() == "the mother":
                if "agenda" in book_title.lower():
                    prefix = "Mother's Agenda"
                else:
                    prefix = "CWM"
            else:
                prefix = "CWSA"  # default if unknown

            # Create the marker string in the desired inline format
            marker = f"[{prefix} - '{book_title}', '{chapter_title}']"
            
            # Option: Append the marker at the end of the text.
            hit_text = hit.get('text', '')
            # Here we append a space and marker at the end.
            hit['text'] = f"{hit_text} {marker}"
            
            # Also update highlighted_text if it exists; otherwise, use the full text.
            hit_highlight = hit.get('highlighted_text', '')
            if hit_highlight:
                hit['highlighted_text'] = f"{hit_highlight} {marker}"
            else:
                hit['highlighted_text'] = hit['text']

            processed_hits.append({
                'author': author,
                'book_title': book_title,
                'chapter_title': chapter_title,
                'search_id': hit.get('search_id', ''),
                'text': hit['text'],
                'highlighted_text': hit['highlighted_text'],
                'file_path': f"/home/olier/Olierclone/www/static/HTML/{book_title}_modified.html"
            })

        return jsonify(processed_hits)

    except Exception as e:
        logger.error(f"Error during Meilisearch query: {e}")
        return jsonify({'error': 'An error occurred during the search.'}), 500




#Old Keyword Search (Replace it if new doesn't work out)*/
'''
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

'''
#Done.


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

### Olier Chat


# --- Model Names ---
# Gemini model for reasoning with grounding
GEMINI_REASONING_MODEL_NAME = 'gemini-2.5-pro-preview-03-25' # Keeping user-specified model

# Fireworks model for the final response ("Olier")
model = "accounts/jaredquek-1b3158/models/oliernov0p5" # Your Olier model

# --- System Messages for Olier (Fireworks) ---
# These remain unchanged as they are for the final Fireworks model
SYSTEM_MESSAGE_PLAIN = (
    "You are Olier, an AI boy. You are an obedient servant of Sri Aurobindo and answer questions with reference to their teachings. "
    "In this dialogue, you will not use any poetry or metaphors. You will speak completely directly, factually and in very simple terms."
)

SYSTEM_MESSAGE_POETIC = (
    "You are Olier, an AI boy. You are very loving and bring a quiet poetry and humor to all you say, "
    "making complex topics simple. You are an obedient servant of Sri Aurobindo and answer questions "
    "with reference to their teachings."
)

# --- Reasoning Instructions for Gemini (Tweaked Detail Integration) ---
# Restored the specific structural example.
# Tweaked the instruction to explicitly ask for *integration* of facts into the steps.
REVISED_REASONING_INSTRUCTION_FORMAT = """Outline how the query should be answered based on the preceding conversation. Do NOT include ANY preamble ("Here is an outline..."etc.). Answer according to the philosophy of Sri Aurobindo and the Mother, if relevant. Where appropriate for the query (e.g., if it asks about history, specific events, or quotes), integrate relevant factual details and (if the query ask for it) direct quotes into your outline after searching online. A sample format for the *structure* of the steps is as such: 
 
 Start with a clear statement acknowledging Divine Love's centrality in his philosophy.
 Explain its fundamental nature and contrast it with human love.
 Describe its connection to Ananda and the psychic being.
 Elaborate on its role as a transformative force in Integral Yoga.
 Briefly touch upon how it is cultivated.
 Conclude by summarizing its significance for individual realization and collective evolution.""" # Keep triple quotes for line breaks

# --- Generation Configuration (for Gemini Reasoning) ---
# Define generation settings for the Gemini reasoning step
# These settings will now be wrapped in GenerateContentConfig
GEMINI_TEMPERATURE = 0.5
# GEMINI_MAX_TOKENS = 500 # Example if needed

# --- Helper function to format messages for Gemini ---
# (Re-added and adapted)
def format_messages_for_gemini(messages_openai_format):
    """Converts OpenAI-style message list to Gemini's content format."""
    gemini_contents = []
    for msg in messages_openai_format:
        role = msg.get('role')
        content = msg.get('content')
        if not role or not content:
            continue
        # Map roles (OpenAI 'assistant' -> Gemini 'model', 'system' ignored here)
        if role == 'system':
             continue # System messages handled separately if needed by Gemini model/config
        gemini_role = 'model' if role == 'assistant' else 'user'
        # Ensure content is a string before creating Part
        if not isinstance(content, str):
            logger.warning(f"Message content is not a string: {content}. Skipping message.")
            continue
        # Use types.Content and types.Part
        gemini_contents.append(types.Content(role=gemini_role, parts=[types.Part(text=content)]))
    return gemini_contents

# --- Initialize Fireworks Client ---
# Already done above after loading key


@app.route('/api/send-message', methods=['POST'])
async def send_message():
    data = await request.get_json()
    messages_openai_format = data.get('messages', []) # Original history from frontend
    if not isinstance(messages_openai_format, list):
         messages_openai_format = []

    style = data.get('style', 'poetic')
    reflective_mode = data.get('reflectiveMode', False)

    # Determine the final list of messages to be sent to Fireworks
    final_fireworks_messages = []
    system_message_to_use = SYSTEM_MESSAGE_PLAIN if style == 'plain' else SYSTEM_MESSAGE_POETIC

    # --- Reflective Mode Logic (Using Gemini) ---
    if reflective_mode:
        original_query = ""
        history_for_gemini_openai_format = []

        if messages_openai_format:
             # Separate history from the last user query
             if messages_openai_format[-1].get('role') == 'user':
                 original_query = messages_openai_format[-1].get('content', "")
                 history_for_gemini_openai_format = messages_openai_format[:-1] # History before the last query
             else:
                 # Handle cases where last message isn't user? Maybe just use full history?
                 logger.warning("Reflective mode triggered but last message not from user. Using full history for context.")
                 original_query = "" # Or try to find last user query?
                 history_for_gemini_openai_format = messages_openai_format

        if original_query:
            reasoning_steps = ""
            try:
                # Format history for Gemini
                gemini_history_contents = format_messages_for_gemini(history_for_gemini_openai_format)

                # Construct the final user prompt for Gemini, asking for reasoning about the actual query
                # Using the REVISED_REASONING_INSTRUCTION_FORMAT
                gemini_reasoning_user_prompt = (
                    f"My specific query, considering the preceding conversation history, is: '{original_query}'.\n\n"
                    f"{REVISED_REASONING_INSTRUCTION_FORMAT}" # This variable contains the tweaked instructions
                )
                logger.debug(f"Reflective Mode - Gemini Reasoning User Prompt: {gemini_reasoning_user_prompt}")

                # Combine history with the new reasoning request
                # Use types.Content and types.Part
                gemini_full_contents = gemini_history_contents + [types.Content(role='user', parts=[types.Part(text=gemini_reasoning_user_prompt)])]

                # *** ADDED FOR DEBUGGING ***
                # Log the full input 'contents' being sent to Gemini
                logger.info(f"Reflective Mode - Full input 'contents' being sent to Gemini: {gemini_full_contents}")

                # Configure the grounding tool
                # *** CORRECTED SYNTAX BELOW ***
                # Use types.Tool and types.GoogleSearch, with correct keyword 'google_search'
                search_tool = types.Tool(google_search=types.GoogleSearch())

                # Configure generation settings
                # Use types.GenerateContentConfig
                gemini_config = types.GenerateContentConfig(
                    tools=[search_tool],
                    temperature=GEMINI_TEMPERATURE,
                    # max_output_tokens=GEMINI_MAX_TOKENS, # Add if defined above
                )

                # Call Gemini model
                logger.debug(f"Calling Gemini model: {GEMINI_REASONING_MODEL_NAME} with history context.")
                reasoning_response = gemini_client.models.generate_content(
                    model=GEMINI_REASONING_MODEL_NAME,
                    contents=gemini_full_contents, # Send history + reasoning request
                    config=gemini_config
                )

                # Extract reasoning steps
                if reasoning_response.prompt_feedback and reasoning_response.prompt_feedback.block_reason:
                     logger.warning(f"Gemini reasoning call blocked: {reasoning_response.prompt_feedback.block_reason_message}")
                     reasoning_steps = f"[Reasoning generation blocked by safety settings: {reasoning_response.prompt_feedback.block_reason_message}]"
                else:
                    if hasattr(reasoning_response, 'text') and reasoning_response.text:
                        reasoning_steps = reasoning_response.text.strip()
                    elif reasoning_response.candidates and reasoning_response.candidates[0].content.parts:
                        reasoning_steps = "".join(part.text for part in reasoning_response.candidates[0].content.parts).strip()
                        if not reasoning_steps: reasoning_steps = "[Gemini response parts were empty]"
                    else:
                        reasoning_steps = "[No text content in Gemini response]"
                    if reasoning_response.candidates and reasoning_response.candidates[0].grounding_metadata:
                         logger.debug(f"Gemini Grounding Metadata: {reasoning_response.candidates[0].grounding_metadata}")
                    else: logger.debug("No grounding metadata found.")

                logger.info(f"Reflective Mode - Gemini Reasoning Steps Received: {reasoning_steps}") # Log the actual steps received

                # --- Prepare LIMITED messages for the FINAL Fireworks model ---
                if reasoning_steps and "Reasoning generation blocked" not in reasoning_steps and "[No text content in Gemini response]" not in reasoning_steps and "[Gemini response parts were empty]" not in reasoning_steps:
                    # Construct the user message combining original query and reasoning
                    query_with_reasoning = (
                        f'Follow closely the following outline to answer the query ("{original_query}"): {reasoning_steps}'
                    )
                    # Build the message list: System Message + User Query w/ Reasoning
                    final_fireworks_messages = [
                        {"role": "system", "content": system_message_to_use},
                        {"role": "user", "content": query_with_reasoning}
                    ]
                    logger.info(f"Reflective Mode - Constructed query for Olier (NO HISTORY): {query_with_reasoning}")
                else:
                    # Failed to get reasoning, fall back to non-reflective mode
                    logger.warning("Reflective Mode: Failed to get valid reasoning steps. Falling back to standard mode.")
                    reflective_mode = False # Set flag to false so non-reflective logic runs

            except Exception as e:
                logger.error(f"An error occurred during Reflective Mode Gemini call: {e}")
                # Fall back to non-reflective mode on error
                reflective_mode = False # Set flag to false so non-reflective logic runs

        else: # No query found, cannot run reflective mode
             logger.warning("Reflective Mode requested but no user query found.")
             reflective_mode = False # Disable reflective mode

    # --- Prepare FINAL API Call to Fireworks ("Olier") ---

    # If reflective mode did NOT run successfully, prepare the full history
    if not final_fireworks_messages: # Check if the list wasn't populated by successful reflective mode
         logger.debug("Preparing full history for Fireworks model (Non-Reflective or Fallback).")
         final_fireworks_messages = messages_openai_format # Start with original history
         # Insert system message if not present
         if not any(msg.get('role') == 'system' for msg in final_fireworks_messages):
              final_fireworks_messages.insert(0, {"role": "system", "content": system_message_to_use})

    # Ensure we always have messages to send
    if not final_fireworks_messages:
        logger.error("No messages prepared to send to Fireworks API.")
        return jsonify({"error": "Failed to prepare messages for the final model."}), 500

    logger.debug(f"Final messages being sent to Fireworks API (Olier): {final_fireworks_messages}")

    # --- Streaming Response from Fireworks ("Olier") ---
    async def event_stream():
        if 'fireworks_client' not in globals() and 'fireworks_client' not in locals():
             logger.error("Fireworks client is not initialized.")
             yield "STREAM_ERROR: Internal server configuration error."
             return
        try:
            stream = fireworks_client.chat.completions.acreate(
                model=model,
                messages=final_fireworks_messages, # Send the correctly prepared list
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
            logger.error(f"An error occurred during Fireworks chat completion streaming: {e}")
            yield f"STREAM_ERROR: An error occurred during final response generation: {e}"

    return Response(event_stream(), mimetype='text/plain')


# --- New Endpoint for Summarizing Search Results with Reference Markers ---
@app.route('/api/summarize-results', methods=['POST'])
async def summarize_results():
    data = await request.get_json()
    results = data.get('results', [])
    user_query = data.get('query', '').strip()  # Get the user's query text
    if not results:
        return jsonify({'error': 'No search results provided.'}), 400

    # Build a reference list string using the author to determine which prefix to use.
    references_text = ""
    # Only use the first 10 results
    top_results = results[:10]
    for result in top_results:
        author = result.get('author', 'Unknown Author').strip()
        book_title = result.get('book_title', 'Unknown Book').strip()
        chapter_title = result.get('chapter_title', 'Unknown Chapter').strip()
        # Determine the reference prefix based on the author.
        if author.lower() == "sri aurobindo":
            prefix = "CWSA"
        elif author.lower() == "the mother":
            # If the book title contains "agenda", then use "Mother's Agenda"
            if "agenda" in book_title.lower():
                prefix = "Mother's Agenda"
            else:
                prefix = "CWM"
        else:
            # Default prefix if author is unknown
            prefix = "CWSA"
        references_text += f"[{prefix} - '{book_title}', '{chapter_title}']\n"

    # Revised prompt: Insert the user query and explicitly instruct inline reference embedding.
    prompt = ( 
    f"User Query: {user_query}\n\n"
    "Based on the detailed top 10 search results provided below, produce a comprehensive and context-aware summary that directly responds to the user's query. "
    "Use the complete text excerpts as context to fully capture the background and nuances of the topic. "
    "IMPORTANT: Embed all reference markers inline exactly where each source is relevant; do not append a separate list at the end. "
    "Each reference marker must be in one of the following formats: "
    "[CWSA - 'Book Title', 'Chapter Title'] for Complete Works of Sri Aurobindo, "
    "[CWM - 'Book Title', 'Chapter Title'] for Collected Works of The Mother, and "
    "[Mother's Agenda - 'Book Title', 'Chapter Title'] for The Mother's Agenda series. "
    "Each marker must be distinct and correspond exactly to one of the provided search results. "
    "Below is the reference list extracted from the top 10 search results:\n"
    f"{references_text}\n"
    "Using this information, generate a detailed summary that answers the user's query using only these top 10 search results."
)

    messages = [
        {"role": "system", "content": SYSTEM_MESSAGE_PLAIN },
        {"role": "user", "content": prompt}
    ]
    try:
        response = fireworks_client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=1500,
            temperature=0.4,
        )
        summary = response.choices[0].message.content.strip()
        return jsonify({'summary': summary})
    except Exception as e:
        logger.error(f"Error during summarization: {e}")
        return jsonify({'error': 'An error occurred during summarization.'}), 500








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
