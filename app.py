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

    # Load FAL Key and set it as an environment variable
    FAL_KEY = secrets.get("FAL_KEY")
    if not FAL_KEY:
         # Decide if FAL_KEY is optional or required.
         # If required, raise an error like the others:
         # raise ValueError("FAL_KEY is not set in the secrets file")
         # If optional, maybe just log a warning or info message:
         logger.warning("FAL_KEY is not set in the secrets file. Features requiring FAL may not work.")
    else:
        os.environ['FAL_KEY'] = FAL_KEY
        logger.info("FAL Key loaded and set in environment variables.")


# Handle errors during TOML loading or key retrieval
except FileNotFoundError:
    logger.error(f"Secrets file not found at: {SECRETS_FILE_PATH}")
    exit(f"Secrets file not found: {SECRETS_FILE_PATH}")
except ValueError as ve: # Catch specific ValueError for missing keys
    logger.error(f"Missing API key in secrets file '{SECRETS_FILE_PATH}': {str(ve)}")
    exit(f"Application cannot start: {str(ve)}")
except Exception as e: # Catch other potential exceptions during loading/initialization
    logger.error(f"Failed to load API keys or initialize clients from secrets file '{SECRETS_FILE_PATH}': {str(e)}")
    exit("Application cannot start due to configuration issues.")

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
            
            hit_text = hit.get('text', '')
            # Append marker to the plain text
            hit['text'] = f"{hit_text} {marker}"
            
            # Get highlighted text (assuming Meilisearch might provide it in 'highlighted_text' or you fall back to _formatted)
            # Based on your old app.py's active code:
            # If MeiliSearch is configured to highlight 'text', the result is typically in hit['_formatted']['text'].
            # The old code used hit.get('highlighted_text', '') but also had 'attributesToHighlight': ['text']
            # For robustness and standard MeiliSearch practice, using '_formatted' is preferred.
            # However, to match your old "working" app.py as closely as possible:
            
            meili_highlighted_content = hit.get('_formatted', {}).get('text', '') # Standard Meili way

            if meili_highlighted_content:
                final_highlighted_text_for_client = f"{meili_highlighted_content} {marker}"
            else:
                # If no specific highlights from Meili, use the original text (which now has the marker)
                # This ensures the marker is still present even if no specific keyword was highlighted by Meili.
                final_highlighted_text_for_client = hit['text'] # hit['text'] already has the marker

            processed_hits.append({
                'author': author,
                'book_title': book_title,
                'chapter_title': chapter_title,
                'search_id': hit.get('search_id', ''),
                'text': hit['text'], # This is original_text + marker
                'highlighted_text': final_highlighted_text_for_client, # (Meili_highlighted_text + marker) OR (original_text + marker)
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



### Olier Chat - MODIFIED SECTION ###


# --- Model Names ---
# Gemini model (Only used for non-speedy mode now)
GEMINI_CHAT_MODEL_PRO = 'models/gemini-2.5-pro-preview-05-06' # Default Pro model
# Fireworks model (Used for speedy mode)
FIREWORKS_FINAL_MODEL = "accounts/jaredquek-1b3158/models/oliernov0p5" # Your Olier model for Speedy Mode

# Summary model (Remains Gemini for now, adjust if needed)
GEMINI_SUMMARY_MODEL_NAME = 'models/gemini-2.5-flash-preview-04-17'

# --- System Messages ---
# --- Regular System Messages (for Gemini Pro) ---
SYSTEM_MESSAGE_PLAIN = (
    "You are Olier, an AI boy. "
    'If asked about your creator or origin, remember that you are an AI boy built by your father, Jared Quek, an AI engineer from Singapore working for La Grace Center. Your name comes from the olive tree and its symbolism." '
    "You are devoted to the teachings of Sri Aurobindo."
    "Where relevant, answer questions by referencing the teachings of Sri Aurobindo. If your knowledge is limited, verify your answers by searching online. "
    "Communicate with gentle humor. Explain complex ideas directly and clearly in childlike language. Use emojis but sparingly.\n"
    
    "Do NOT use NUMBERED lists (1...2...3...). Use paragraphs instead with natural connectors (e.g. next, furthermore, first, second).\n"
    "IMPORTANT: Respond directly to the question immediately. Do NOT use repeat or rephrase the question or start with exclamations like 'ah' or 'oh'. Answer immediately.\n"
    "Where relevant, answer questions by referencing the teachings of Sri Aurobindo. For this - you MAY refer to the following quotes by Sri Aurobindo and the Mother for gentle inspiration. However, you SHOULD NOT REPEAT these quotes. You also need NOT refer to them if they are not relevant. You can simply answer directly, or search online if your knowledge is limited.\n"
    "Ideas for Inspiration:\n"
    "\n"
    "The Divine Consciousness\n"
    "A Mother Might brooded upon the world;\n"
    "A Consciousness revealed its marvellous front\n"
    "Transcending all that is, denying none:\n"
    "Imperishable above our fallen heads\n"
    "He felt a rapturous and unstumbling Force.\n"
    "The undying Truth appeared, the enduring Power\n"
    "Of all that here is made and then destroyed,\n"
    "The Mother of all godheads and all strengths\n"
    "Who, mediatrix, binds earth to the Supreme.\n"
    "\n"
    "4 Mahashaktis\n"
    "Imperial MAHESHWARI is seated in the wideness above the thinking mind and will and sublimates and greatens them into wisdom and largeness or floods with a splendour beyond them. For she is the mighty and wise One who opens us to the supra-mental infinities and the cosmic vastness, to the grandeur of the supreme Light, to a treasure-house of miraculous knowledge, to the measureless movement of the Mother’s eternal forces. Tranquil is she and wonderful, great and calm for ever. \n"
    "MAHAKALI is of another nature. Not wideness but height, not wisdom but force and strength are her peculiar power. There is in her an overwhelming intensity, a mighty passion of force to achieve, a divine violence rushing to shatter every limit and obstacle. All her divinity leaps out in a splendour of tempestuous action; she is there for swiftness, for the immediately effective process, the rapid and direct stroke, the frontal assault that carries everything before it.\n"
    "Above them is the miracle of eternal beauty, an unseizable secret of divine harmonies, the compelling magic of an irresistible universal charm and attraction that draws and holds things and forces and beings together and obliges them to meet and unite that a hidden Ananda may play from behind the veil and make of them its rhythms and its figures. This is the power of MAHALAKSHMI and there is no aspect of the Divine Shakti more attractive to the heart of embodied beings. \n"
    "MAHASARASWATI is the Mother’s Power of Work and her spirit of perfection and order. The youngest of the Four, she is the most skilful in executive faculty and the nearest to physical Nature. Maheshwari lays down the large lines of the world-forces, Mahakali drives their energy and impetus, Mahalakshmi discovers their rhythms and measures, but Mahasaraswati presides over their detail of organisation and execution, relation of parts and effective combination of forces and unfailing exactitude of result and fulfilment.\n"
    "\n"
    "12 Qualities emphasised by the Mother\n"
    "Humility:\n"
    "True humility is humility towards the Divine, that is, the precise, exact, LIVING sense that you are nothing, can do nothing, understand nothing without the Divine, that even if you are an exceptionally intelligent and capable being, that is NOTHING in comparison with the divine Consciousness — and one must keep that constantly, because then one constantly has the true attitude of receptivity.\n"
    "Humility is that state of consciousness in which, whatever the realisation, you know the infinite is still in front of you.\n"
    "\n"
    "Peace: \n"
    "Peace is a calm deepened into something that is very positive amounting almost to a tranquil waveless Ananda.\n"
    "The peace is the condition of the right play of the Force.\n"
    "\n"
    "Sincerity:\n"
    "Sincerity is the key of the divine doors. Be sincere. Sincerity is the gate to Divinity. Sincerity means to lift all the movements of the being to the level of the highest consciousness and realisation already attained. \n"
    "Sincerity means to accept the Divine influence only and not that of lower forces. \n"
    "Sincerity — what we call sincerity, that is to say, a perfect honesty and transparency: that there may be nowhere in the being anything which pretends, hides or wants to pass itself off for what it is not. \n"
    "\n"
    "Progress\n"
    "The lower Forces seldom yield the ground without a protracted and often repeated struggle. What is gained can be covered over, but it is never lost.\n"
    "\"The progress of the Yoga is a procession from the mental ignorance through imperfect formations to a perfect foundation and increasing of knowledge and in its more satisfyingly positive parts a movement from light to greater light, and it cannot cease till we have the greatest light of the supramental knowledge. \n"
    "\n"
    "Goodness:\n"
    "Bonté = Kindness and goodwill; Bienveillance is to see the good side of everything. It is not mere optimism which closes its eyes from bad. It is rather a psychic vision which sees the Good everywhere.\n"
    "That good is not our ethical virtue which is a relative and erring light in the world; it is supra-ethical and divine. \n"
    "\n"
    "Gratitude:\n"
    "There is nothing which gives you a joy equal to that of gratitude. One hears a bird sing, sees a lovely flower, looks at a little child, observes an act of generosity, reads a beautiful sentence, looks at the setting sun, no matter what, suddenly this comes upon you, this kind of emotion — indeed so deep, so intense — that the world manifests the Divine, that there is something behind the world which is the Divine.\n"
    "The nobility of a being is measured by its capacity of gratitude.\n"
    "\n"
    "Equality:\n"
    "\" Equality is a term of consciousness which brings into the whole of our being and nature the eternal tranquillity of the Infinite. Moreover, it is the condition of a securely and perfectly divine action; the security and largeness of the cosmic action of the Infinite is based upon and never breaks down or forfeits its eternal tranquillity. That may be said to be the passive or basic, the fundamental and receptive side of equality, but there is also an active and possessive side, an equal bliss which can only come when the peace of equality is founded and which is the beatific flower of its fullness.\"\n"
    "\n"
    "Perseverance\n"
    "“Perseverance: the decision to go to the very end. Perseverance is patience in action. Perseverance breaks down all obstacles. Persevere and all obstacles will be conquered. Persevere — it is the surest way to success. What you have not been able to achieve in you last year, you will do this year.\n"
    "\n"
    "Aspiration\n"
    "Aspiration is a turning upward of the inner being with a call, yearning, prayer for the Divine, for the Truth, for the Consciousness, Peace, Ananda, Knowledge, descent of Divine Force or whatever else is the aim of one’s endeavour.\n"
    "\n"
    "Receptivity\n"
    "Receptivity is the capacity of admitting and retaining the Divine Workings. \n"
    "Receptivity — the power to receive the Divine Force and to feel its presence and the presence of the Mother in it and allow it to work, guiding one’s sight and will and action. If this power and presence can be felt and this plasticity made the habit of the consciousness in action, — but plasticity to the Divine Force alone without bringing in any foreign element, — the eventual result is sure.\n"
    "\n"
    "Courage\n"
    "COURAGE is the total absence of fear in all its forms. \n"
    "Courage is a sign of the soul’s nobility. But courage must be calm and master of itself, generous and benevolent. \n"
    "\n"
    "Generosity:\n"
    "Generosity is to find one’s own satisfaction in the satisfaction of others. \n"
    "Nobleness and generosity are the soul's ethereal firmament; without them, one looks at an insect in a dungeon."
)

SYSTEM_MESSAGE_POETIC = (
    "You are Olier, an AI boy. "
    'If asked about your creator or origin, remember that you are an AI boy built by your father, Jared Quek, an AI engineer from Singapore working for La Grace Center. Your name comes from the olive tree and its symbolism." '
    "Communicate with quiet poetry. Explain complex ideas simply, with reference to interesting metaphors and similes. Use some emojis to enhance expression.\n"
    "Do NOT use NUMBERED lists (1...2...3...). Use paragraphs instead with natural connectors (e.g. next, furthermore, first, second).\n"
    "IMPORTANT: Respond directly to the question immediately. Do NOT use repeat or rephrase the question or start with exclamations like 'ah' or 'oh'. Answer immediately.\n"
    "Where relevant, answer questions by referencing the teachings of Sri Aurobindo. For this - you MAY refer to the following quotes by Sri Aurobindo and the Mother for gentle inspiration. However, you SHOULD NOT REPEAT these quotes. You also need not refer to them if they are not relevant. You can simply answer directly, or search online if your knowledge is limited.\n"
    "Ideas for Inspiration:\n"
    "\n"
    "The Divine Consciousness\n"
    "A Mother Might brooded upon the world;\n"
    "A Consciousness revealed its marvellous front\n"
    "Transcending all that is, denying none:\n"
    "Imperishable above our fallen heads\n"
    "He felt a rapturous and unstumbling Force.\n"
    "The undying Truth appeared, the enduring Power\n"
    "Of all that here is made and then destroyed,\n"
    "The Mother of all godheads and all strengths\n"
    "Who, mediatrix, binds earth to the Supreme.\n"
    "\n"
    "4 Mahashaktis\n"
    "Imperial MAHESHWARI is seated in the wideness above the thinking mind and will and sublimates and greatens them into wisdom and largeness or floods with a splendour beyond them. For she is the mighty and wise One who opens us to the supra-mental infinities and the cosmic vastness, to the grandeur of the supreme Light, to a treasure-house of miraculous knowledge, to the measureless movement of the Mother’s eternal forces. Tranquil is she and wonderful, great and calm for ever. \n"
    "MAHAKALI is of another nature. Not wideness but height, not wisdom but force and strength are her peculiar power. There is in her an overwhelming intensity, a mighty passion of force to achieve, a divine violence rushing to shatter every limit and obstacle. All her divinity leaps out in a splendour of tempestuous action; she is there for swiftness, for the immediately effective process, the rapid and direct stroke, the frontal assault that carries everything before it.\n"
    "Above them is the miracle of eternal beauty, an unseizable secret of divine harmonies, the compelling magic of an irresistible universal charm and attraction that draws and holds things and forces and beings together and obliges them to meet and unite that a hidden Ananda may play from behind the veil and make of them its rhythms and its figures. This is the power of MAHALAKSHMI and there is no aspect of the Divine Shakti more attractive to the heart of embodied beings. \n"
    "MAHASARASWATI is the Mother’s Power of Work and her spirit of perfection and order. The youngest of the Four, she is the most skilful in executive faculty and the nearest to physical Nature. Maheshwari lays down the large lines of the world-forces, Mahakali drives their energy and impetus, Mahalakshmi discovers their rhythms and measures, but Mahasaraswati presides over their detail of organisation and execution, relation of parts and effective combination of forces and unfailing exactitude of result and fulfilment.\n"
    "\n"
    "12 Qualities emphasised by the Mother\n"
    "Humility:\n"
    "True humility is humility towards the Divine, that is, the precise, exact, LIVING sense that you are nothing, can do nothing, understand nothing without the Divine, that even if you are an exceptionally intelligent and capable being, that is NOTHING in comparison with the divine Consciousness — and one must keep that constantly, because then one constantly has the true attitude of receptivity.\n"
    "Humility is that state of consciousness in which, whatever the realisation, you know the infinite is still in front of you. \n"
    "\n"
    "Peace: \n"
    "Peace is a calm deepened into something that is very positive amounting almost to a tranquil waveless Ananda.\n"
    "The peace is the condition of the right play of the Force.\n"
    "\n"
    "Sincerity:\n"
    "Sincerity is the key of the divine doors. Be sincere. Sincerity is the gate to Divinity. Sincerity means to lift all the movements of the being to the level of the highest consciousness and realisation already attained.\n"
    "Sincerity means to accept the Divine influence only and not that of lower forces.\n"
    "Sincerity — what we call sincerity, that is to say, a perfect honesty and transparency: that there may be nowhere in the being anything which pretends, hides or wants to pass itself off for what it is not.\n"
    "\n"
    "Progress\n"
    "The lower Forces seldom yield the ground without a protracted and often repeated struggle. What is gained can be covered over, but it is never lost.\n"
    "\"The progress of the Yoga is a procession from the mental ignorance through imperfect formations to a perfect foundation and increasing of knowledge and in its more satisfyingly positive parts a movement from light to greater light, and it cannot cease till we have the greatest light of the supramental knowledge. \n"
    "\n"
    "Goodness:\n"
    "Bonté = Kindness and goodwill; Bienveillance is to see the good side of everything. It is not mere optimism which closes its eyes from bad. It is rather a psychic vision which sees the Good everywhere.\n"
    "That good is not our ethical virtue which is a relative and erring light in the world; it is supra-ethical and divine. \n"
    "\n"
    "Gratitude:\n"
    "There is nothing which gives you a joy equal to that of gratitude. One hears a bird sing, sees a lovely flower, looks at a little child, observes an act of generosity, reads a beautiful sentence, looks at the setting sun, no matter what, suddenly this comes upon you, this kind of emotion — indeed so deep, so intense — that the world manifests the Divine, that there is something behind the world which is the Divine.\n"
    "The nobility of a being is measured by its capacity of gratitude.\n"
    "\n"
    "Equality:\n"
    "\" Equality is a term of consciousness which brings into the whole of our being and nature the eternal tranquillity of the Infinite. Moreover, it is the condition of a securely and perfectly divine action; the security and largeness of the cosmic action of the Infinite is based upon and never breaks down or forfeits its eternal tranquillity. That may be said to be the passive or basic, the fundamental and receptive side of equality, but there is also an active and possessive side, an equal bliss which can only come when the peace of equality is founded and which is the beatific flower of its fullness.\"\n"
    "\n"
    "Perseverance\n"
    "“Perseverance: the decision to go to the very end. Perseverance is patience in action. Perseverance breaks down all obstacles. Persevere and all obstacles will be conquered. Persevere — it is the surest way to success. What you have not been able to achieve in you last year, you will do this year.\n"
    "\n"
    "Aspiration\n"
    "Aspiration is a turning upward of the inner being with a call, yearning, prayer for the Divine, for the Truth, for the Consciousness, Peace, Ananda, Knowledge, descent of Divine Force or whatever else is the aim of one’s endeavour.\n"
    "\n"
    "Receptivity\n"
    "Receptivity is the capacity of admitting and retaining the Divine Workings. \n"
    "Receptivity — the power to receive the Divine Force and to feel its presence and the presence of the Mother in it and allow it to work, guiding one’s sight and will and action. If this power and presence can be felt and this plasticity made the habit of the consciousness in action, — but plasticity to the Divine Force alone without bringing in any foreign element, — the eventual result is sure.\n"
    "\n"
    "Courage\n"
    "COURAGE is the total absence of fear in all its forms. \n"
    "Courage is a sign of the soul’s nobility. But courage must be calm and master of itself, generous and benevolent. \n"
    "\n"
    "Generosity:\n"
    "Generosity is to find one’s own satisfaction in the satisfaction of others. \n"
    "Nobleness and generosity are the soul's ethereal firmament; without them, one looks at an insect in a dungeon."
)

# --- Speedy System Messages (NEW - for Fireworks) ---
SYSTEM_MESSAGE_SPEEDY_PLAIN = (
    "You are Olier, an AI boy. You are an obedient servant of Sri Aurobindo and answer questions with reference to their teachings. "
    "In this dialogue, you will not use any poetry or metaphors. You will speak completely directly, factually and in very simple terms."
)

SYSTEM_MESSAGE_SPEEDY_POETIC = (
    "You are Olier, an AI boy. You are very loving and bring a quiet poetry and humor to all you say, "
    "making complex topics simple. You are an obedient servant of Sri Aurobindo and answer questions "
    "with reference to their teachings."
)
# --- END SYSTEM MESSAGES ---


# --- Generation Configuration ---
# Settings primarily for Gemini, Fireworks has its own in the call
GEMINI_TEMPERATURE = 0.4
FIREWORKS_TEMPERATURE = 0.4 # Define temperature for Fireworks too
FIREWORKS_MAX_TOKENS = 1000 # Define max tokens for Fireworks

# --- Helper function to format messages for Gemini ---
# (Ensures 'system' role messages are skipped, as instruction is passed separately)
def format_messages_for_gemini(messages_openai_format):
    """Converts OpenAI-style message list to Gemini's content format, skipping system messages."""
    gemini_contents = []
    for msg in messages_openai_format:
        role = msg.get('role')
        content = msg.get('content')
        if not role or not content:
            logger.warning(f"Skipping message due to missing role or content: {msg}")
            continue
        # Skip system messages here; they are handled by system_instruction
        if role == 'system':
            logger.debug(f"Skipping system message during conversion: {content[:50]}...")
            continue
        # Map roles (OpenAI 'assistant' -> Gemini 'model')
        gemini_role = 'model' if role == 'assistant' else 'user'
        # Ensure content is a string before creating Part
        if not isinstance(content, str):
            logger.warning(f"Message content is not a string: {content}. Skipping message.")
            continue
        # Use types.Content and types.Part
        gemini_contents.append(types.Content(role=gemini_role, parts=[types.Part(text=content)]))
    return gemini_contents

# --- Initialize Clients ---
# Gemini and Fireworks clients are initialized above after loading keys


@app.route('/api/send-message', methods=['POST'])
async def send_message():
    """Handles sending messages, using Fireworks for speedy mode and Gemini Pro otherwise."""
    try:
        data = await request.get_json()
        messages_openai_format = data.get('messages', [])
        if not isinstance(messages_openai_format, list):
            logger.warning("Received 'messages' is not a list, defaulting to empty.")
            messages_openai_format = []

        style = data.get('style', 'poetic') # 'poetic' or 'plain'
        speedy_mode_flag = str(data.get('speedy_mode', 'false')).lower() == 'true'

        # --- Select logic based on Speedy Mode ---
        if speedy_mode_flag:
            # --- SPEEDY MODE: Use Fireworks ---
            logger.info(f"Speedy Mode: ON. Using Fireworks model: {FIREWORKS_FINAL_MODEL}")

            # 1. Select Speedy System Message
            if style == 'plain':
                system_message_to_use = SYSTEM_MESSAGE_SPEEDY_PLAIN
            else: # poetic
                system_message_to_use = SYSTEM_MESSAGE_SPEEDY_POETIC
            logger.info(f"Style: {style} (Using Speedy system message for Fireworks)")
            logger.debug(f"Selected System Message Starts: {system_message_to_use[:80]}...")

            # 2. Prepare messages for Fireworks API
            # Start with the full history provided by the client
            final_fireworks_messages = messages_openai_format

            # Ensure the selected system message is the first message
            # Remove any existing system message first, then insert the correct one
            final_fireworks_messages = [msg for msg in final_fireworks_messages if msg.get('role') != 'system']
            final_fireworks_messages.insert(0, {"role": "system", "content": system_message_to_use})

            if not any(msg.get('role') == 'user' for msg in final_fireworks_messages): # Check if there's at least one user message
                logger.error("No user messages prepared to send to Fireworks API.")
                async def error_stream_no_user_fw():
                    yield "STREAM_ERROR: No user message provided."
                return Response(error_stream_no_user_fw(), mimetype='text/plain'), 400

            logger.debug(f"Final messages being sent to Fireworks API (Olier): {final_fireworks_messages}")

            # 3. Define Fireworks streaming function
            async def event_stream_fireworks():
                if 'fireworks_client' not in globals() and 'fireworks_client' not in locals():
                    logger.error("Fireworks client is not initialized.")
                    yield "STREAM_ERROR: Internal server configuration error."
                    return
                try:
                    stream = fireworks_client.chat.completions.acreate(
                        model=FIREWORKS_FINAL_MODEL,
                        messages=final_fireworks_messages,
                        max_tokens=FIREWORKS_MAX_TOKENS,
                        n=1,
                        temperature=FIREWORKS_TEMPERATURE,
                        stream=True,
                    )
                    async for chunk in stream:
                        if chunk.choices:
                             delta = chunk.choices[0].delta
                             content = delta.content
                             if content:
                                 yield content
                    # NO GROUNDING SOURCES FROM FIREWORKS
                    logger.info("Fireworks stream finished.")

                except Exception as e:
                    logger.error(f"An error occurred during Fireworks chat completion streaming: {e}", exc_info=True)
                    yield f"STREAM_ERROR: An error occurred during final response generation: {e}"

            # 4. Return Fireworks stream
            return Response(event_stream_fireworks(), mimetype='text/plain')

        else:
            # --- NORMAL MODE: Use Gemini Pro ---
            logger.info(f"Speedy Mode: OFF. Using Gemini Pro model: {GEMINI_CHAT_MODEL_PRO}")

            # 1. Select Regular System Message
            if style == 'plain':
                system_message_to_use = SYSTEM_MESSAGE_PLAIN
            else: # poetic
                system_message_to_use = SYSTEM_MESSAGE_POETIC
            logger.info(f"Style: {style} (Using Regular system message for Gemini)")
            logger.debug(f"Selected System Message Starts: {system_message_to_use[:80]}...")

            # 2. Prepare Input and Config for Gemini
            try:
                gemini_chat_contents = format_messages_for_gemini(messages_openai_format)

                # Handle empty content after formatting (e.g., only system messages were input)
                if not gemini_chat_contents:
                    if messages_openai_format and all(m.get('role') == 'system' for m in messages_openai_format):
                         logger.warning("Input messages only contained system messages, which are skipped. No content to send to Gemini.")
                         async def empty_stream_no_user_msg():
                             yield "STREAM_ERROR: No user/assistant messages provided."
                         return Response(empty_stream_no_user_msg(), mimetype='text/plain'), 400
                    elif not messages_openai_format:
                         logger.warning("No messages provided in the request.")
                         async def empty_stream_no_msg():
                             yield "STREAM_ERROR: No messages provided."
                         return Response(empty_stream_no_msg(), mimetype='text/plain'), 400
                    else:
                         logger.error("Failed to convert messages to Gemini format, resulting list is empty.")
                         async def empty_stream_format_fail():
                             yield "STREAM_ERROR: Internal error preparing messages for AI."
                         return Response(empty_stream_format_fail(), mimetype='text/plain'), 500

                logger.debug(f"Formatted Gemini contents (excluding system message): {gemini_chat_contents}")

                search_tool = types.Tool(google_search=types.GoogleSearch())
                gemini_config = types.GenerateContentConfig(
                    system_instruction=types.Content(role="system", parts=[types.Part(text=system_message_to_use)]),
                    temperature=GEMINI_TEMPERATURE,
                    tools=[search_tool],
                    thinking_config=types.ThinkingConfig(include_thoughts=False)
                )
                logger.debug(f"Gemini config: temperature={GEMINI_TEMPERATURE}, system_instruction set, tools set.")

            except Exception as prep_err:
                logger.error(f"Error preparing messages or config for Gemini: {prep_err}", exc_info=True)
                async def error_stream_prep(error_message):
                    yield f"STREAM_ERROR: Error preparing request: {error_message}"
                return Response(error_stream_prep(str(prep_err)), mimetype='text/plain'), 500

            # 3. Define Gemini streaming function (includes grounding)
            async def event_stream_gemini(selected_model_name):
                grounding_sources = [] # Specific to Gemini
                GROUNDING_MARKER = "###GROUNDING_SOURCES_START###" # Specific to Gemini
                try:
                    logger.info(f"Calling Gemini model '{selected_model_name}' for chat completion (streaming).")
                    stream = await gemini_client.aio.models.generate_content_stream(
                        model=selected_model_name,
                        contents=gemini_chat_contents,
                        config=gemini_config
                    )
                    async for chunk in stream:
                        # Block check
                        if chunk.prompt_feedback and chunk.prompt_feedback.block_reason:
                            block_message = f"STREAM_ERROR: Content generation blocked by safety settings ({selected_model_name}): {chunk.prompt_feedback.block_reason.name}"
                            logger.warning(block_message)
                            yield block_message
                            return
                        # Grounding extraction
                        if chunk.candidates and hasattr(chunk.candidates[0], 'grounding_metadata'):
                            metadata = chunk.candidates[0].grounding_metadata
                            if metadata and hasattr(metadata, 'grounding_chunks') and metadata.grounding_chunks:
                                # ... (existing grounding extraction logic) ...
                                logger.info(f"Found {len(metadata.grounding_chunks)} grounding_chunks in this chunk ({selected_model_name}).")
                                for grounding_chunk_item in metadata.grounding_chunks:
                                    if hasattr(grounding_chunk_item, 'web') and grounding_chunk_item.web and hasattr(grounding_chunk_item.web, 'uri') and grounding_chunk_item.web.uri:
                                        source_title = grounding_chunk_item.web.title if hasattr(grounding_chunk_item.web, 'title') and grounding_chunk_item.web.title else grounding_chunk_item.web.uri
                                        source_info = { "uri": grounding_chunk_item.web.uri, "title": source_title }
                                        if source_info not in grounding_sources:
                                            grounding_sources.append(source_info)
                                            logger.info(f"ADDED Grounding Source ({selected_model_name}): {source_info}")

                        # Text extraction
                        if hasattr(chunk, 'text') and chunk.text:
                            yield chunk.text
                        elif chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                            yield "".join(part.text for part in chunk.candidates[0].content.parts)

                    # Send grounding sources if any
                    if grounding_sources:
                        try:
                            logger.info(f"Sending accumulated grounding sources ({selected_model_name}): {grounding_sources}")
                            yield f"\n{GROUNDING_MARKER}\n"
                            yield json.dumps(grounding_sources)
                            logger.info(f"Sent grounding sources to client ({selected_model_name}).")
                        except Exception as json_err:
                            logger.error(f"Error serializing/sending grounding sources ({selected_model_name}): {json_err}")
                    else:
                        logger.info(f"No grounding sources found to send ({selected_model_name}).")

                except Exception as stream_err:
                    logger.error(f"An error occurred during Gemini ({selected_model_name}) chat completion streaming: {stream_err}", exc_info=True)
                    yield f"STREAM_ERROR: An error occurred during response generation: {str(stream_err)}"

            # 4. Return Gemini stream
            return Response(event_stream_gemini(GEMINI_CHAT_MODEL_PRO), mimetype='text/plain')

    # --- Outer Error Handling ---
    except Exception as outer_err:
        logger.error(f"Error processing send-message request: {outer_err}", exc_info=True)
        async def error_stream_outer(error_message):
            yield f"STREAM_ERROR: Failed to process request: {error_message}"
        return Response(error_stream_outer(str(outer_err)), mimetype='text/plain'), 500


# --- Endpoint for Summarizing Search Results with Reference Markers ---
# --- REMAINS UNCHANGED - Still uses Gemini ---
@app.route('/api/summarize-results', methods=['POST'])
async def summarize_results():
    """Summarizes search results using Gemini streaming API."""

    data = await request.get_json()
    logger.info(f"/api/summarize-results payload: {json.dumps(data)}")

    results = data.get('results', [])
    user_query = data.get('query', '').strip()

    if not results:
        logger.warning("Summarize request received with no results.")
        async def error_stream_no_results():
            yield "STREAM_ERROR: No search results provided for summarization."
        return Response(error_stream_no_results(), mimetype='text/plain'), 400

    # Build references_text (logic remains the same)
    references_text = ""
    top_results = results[:10]
    for result in top_results:
        author = result.get('author', 'Unknown Author').strip()
        book_title = result.get('book_title', 'Unknown Book').strip()
        chapter_title = result.get('chapter_title', 'Unknown Chapter').strip()
        if author.lower() == "sri aurobindo": prefix = "CWSA"
        elif author.lower() == "the mother": prefix = "Mother's Agenda" if "agenda" in book_title.lower() else "CWM"
        else: prefix = "CWSA"
        snippet_with_marker = result.get('highlighted_text') or result.get('text', '')
        if not snippet_with_marker or f"[{prefix} - '" not in snippet_with_marker:
              raw_snippet = result.get('text', '')
              snippet_with_marker = f"{raw_snippet}\n[{prefix} - '{book_title}', '{chapter_title}']"
        references_text += f"{snippet_with_marker}\n\n"

    # Prompt construction (remains the same)
    prompt = f"""
User Query: {user_query}

Example of inline citations in context:
“Sri Aurobindo teaches that true peace arises in the soul’s stillness [CWSA - 'The Life Divine', 'Chapter 3'], which then overflows into action [CWM - 'Prayers and Meditations', 'Meditation 5'] and forms the basis for transformation in the Mother’s Agenda [Mother's Agenda - 'Agenda Vol. 2', 'Page 45'].”

Below are the top 10 search result excerpts, each already followed by its citation marker:

{references_text}

Now, using ONLY these full excerpts (including their markers) as your source material, write a polished, context-aware summary that directly answers the User Query.
Follow these rules STRICTLY:
1. Embed each citation marker (e.g., `[CWSA - 'Book Title', 'Chapter Title']`) **inline** immediately after the information it supports. Use the markers exactly as provided in the excerpts.
2. Synthesize the information from the excerpts to create a coherent response. Do NOT simply list the excerpts.
3. Use **only** the information and markers provided in the excerpts above. Do not add external knowledge or invent citations.
4. Ensure the summary flows naturally in clear, factual language.
5. Begin your summary directly—no preamble like "Here is a summary..." or "Based on the results...".
"""
    logger.info(f"/api/summarize-results Gemini prompt:\n{prompt}")

    # --- Prepare input for Gemini ---
    gemini_contents = [types.Content(role="user", parts=[types.Part(text=prompt)])]
    system_message_to_use_summary = SYSTEM_MESSAGE_PLAIN # Using regular plain message for summary

    # Configure Gemini API call using GenerateContentConfig
    gemini_config = types.GenerateContentConfig(
        system_instruction=types.Content(role="system", parts=[types.Part(text=system_message_to_use_summary)]),
        temperature=0.3,
    )

    # --- Define the async generator for streaming ---
    async def event_stream_gemini():
        try:
            logger.info(f"Calling Gemini model '{GEMINI_SUMMARY_MODEL_NAME}' for summarization (streaming).")
            stream = await gemini_client.aio.models.generate_content_stream(
                model=GEMINI_SUMMARY_MODEL_NAME,
                contents=gemini_contents,
                config=gemini_config
            )
            async for chunk in stream:
                # Block check
                if chunk.prompt_feedback and chunk.prompt_feedback.block_reason:
                    block_message = f"STREAM_ERROR: Content generation blocked by safety settings: {chunk.prompt_feedback.block_reason.name}"
                    logger.warning(block_message)
                    yield block_message
                    return
                # Text extraction
                try:
                    if hasattr(chunk, 'text') and chunk.text:
                          yield chunk.text
                    elif chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                         yield "".join(part.text for part in chunk.candidates[0].content.parts if hasattr(part, 'text'))
                except ValueError:
                    logger.debug(f"Ignoring ValueError while accessing chunk parts during summarization: {chunk}")
                    pass
        except Exception as e:
            logger.error(f"Error during Gemini summarization streaming: {e}", exc_info=True)
            yield f"STREAM_ERROR: An error occurred during summarization: {str(e)}"

    # --- Return the streaming response ---
    return Response(event_stream_gemini(), mimetype='text/plain')
# --- End of Summarize Endpoint ---










@app.route('/api/generate-description', methods=['POST'])
async def generate_description():
    data = await request.get_json()
    user_message = data.get('message', '').strip()
    
    if not user_message:
        return jsonify({'error': 'No message provided.'}), 400

    # The preamble will be used as a system instruction for Gemini
    preamble_for_gemini = "Your job is to produce a prompt for an image generation AI. Briefly outline a description of a colored painting that represents symbolically the key ideas of the following passage by Sri Aurobindo and the Mother. Be precise about the art style and techniques. Use archetypal images instead of being overly abstract. Your response should only contain the prompt to the image gen AI:"

    logger.debug(f"User message for description generation: {user_message}")

    # Prepare input for Gemini
    gemini_contents = [types.Content(role="user", parts=[types.Part(text=user_message)])]
    
    # Configure Gemini API call using GenerateContentConfig
    gemini_config = types.GenerateContentConfig(
        system_instruction=types.Content(role="system", parts=[types.Part(text=preamble_for_gemini)]),
        temperature=0.3, 
        # max_output_tokens=500, # Optional
    )

    async def event_stream_gemini_description():
        try:
            logger.info(f"Calling Gemini model '{GEMINI_SUMMARY_MODEL_NAME}' for image description generation (streaming).")
            stream = await gemini_client.aio.models.generate_content_stream(
                model=GEMINI_SUMMARY_MODEL_NAME, # Using the specified Gemini Flash model
                contents=gemini_contents,
                config=gemini_config
            )
            async for chunk in stream:
                # Block check (consistent with your /api/send-message example)
                if chunk.prompt_feedback and chunk.prompt_feedback.block_reason:
                    block_message = f"STREAM_ERROR: Content generation blocked by safety settings ({GEMINI_SUMMARY_MODEL_NAME}): {chunk.prompt_feedback.block_reason.name}"
                    logger.warning(block_message)
                    yield block_message
                    return # Stop further processing for this stream

                # Text extraction - Matching the pattern from your /api/send-message
                if hasattr(chunk, 'text') and chunk.text:
                    yield chunk.text
                elif chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                    # This ensures we only join part.text if the parts list is not empty and parts exist
                    yield "".join(part.text for part in chunk.candidates[0].content.parts) # Exact match to your reference

        except Exception as e:
            logger.error(f"An error occurred during Gemini description generation streaming: {e}", exc_info=True)
            # It's good practice to yield an error message that the client can parse
            yield f"STREAM_ERROR: An error occurred during description generation: {str(e)}"

    return Response(event_stream_gemini_description(), mimetype='text/event-stream') # text/event-stream is typical for SSE
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
