import numpy as np
import cohere
import toml
# import torch # Note: torch import seems unused, consider removing
import json
import asyncio
import os
import sys
# import hashlib # Note: hashlib import seems unused, consider removing
from qdrant_client import QdrantClient
import logging # Added for better logging

# Setup logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO) # Adjust level as needed

# --- Client Initialization (Example) ---
try:
    # Ensure this path is correct in your deployment environment
    secrets_path = '/home/olier/DataGenResearch/Datagen/secrets.toml'
    logger.info(f"Attempting to load secrets from: {secrets_path}")
    secrets = toml.load(secrets_path)
    cohere_api_key = secrets.get("COHERE_API_KEY")
    if not cohere_api_key:
        logger.warning("COHERE_API_KEY not found in secrets file.")
        cohere_api_key = os.environ.get("COHERE_API_KEY") # Fallback to environment variable
    if not cohere_api_key:
         logger.error("Cohere API key not found in secrets.toml or environment variables.")
         raise ValueError("Cohere API key is required.")
    logger.info("Cohere API key loaded successfully.")
except FileNotFoundError:
    logger.warning(f"Secrets file not found at {secrets_path}. Attempting to use environment variables.")
    cohere_api_key = os.environ.get("COHERE_API_KEY")
    if not cohere_api_key:
         logger.error("Cohere API key not found in environment variables.")
         raise ValueError("Cohere API key is required.")
except Exception as e:
    logger.error(f"Error loading secrets.toml: {e}")
    raise # Re-raise the exception after logging

# Initialize the Async Cohere client
co = cohere.AsyncClient(api_key=cohere_api_key)
logger.info("Cohere AsyncClient initialized.")

# Qdrant Client Initialization
QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not QDRANT_URL:
    logger.error("QDRANT_URL environment variable not set.")
    sys.exit("Qdrant URL is required.")
if not QDRANT_API_KEY:
    # Qdrant might allow connections without API key depending on setup
    logger.warning("QDRANT_API_KEY environment variable not set. Attempting connection without key.")

try:
    qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60.0)
    # Optional: Add a ping or info call to verify connection early
    # qdrant_client.get_collections()
    logger.info(f"QdrantClient initialized for URL: {QDRANT_URL}")
except Exception as e:
    logger.error(f"Failed to initialize Qdrant client: {e}")
    sys.exit("Could not connect to Qdrant.")
# --- End Client Initialization ---


# --- Dataset Identifiers ---
dataset_identifier1 = 'aurocoherecomplete'    # Sri Aurobindo's data
dataset_identifier2 = 'mothercoherecomplete'  # The Mother's data
logger.info(f"Using Qdrant collections: '{dataset_identifier1}' (Aurobindo), '{dataset_identifier2}' (Mother)")
# --- End Dataset Identifiers ---

# --- Metadata File Path ---
METADATA_FILE_PATH = '/home/olier/Olierclone/merged_auromira.jsonl'
logger.info(f"Using metadata file: {METADATA_FILE_PATH}")
# --- End Metadata File Path ---


async def embed_query(query: str):
    """Embed the query using Cohere model with search_query input type."""
    try:
        response = await co.embed(
            model="embed-english-v3.0",
            input_type="search_query",
            texts=[query],
            truncate="NONE"
        )
        if not response.embeddings:
             logger.error("Cohere embed API returned no embeddings.")
             raise ValueError("Failed to generate query embedding.")
        return np.array(response.embeddings[0])
    except Exception as e:
        logger.error(f"Error during Cohere query embedding: {e}")
        raise # Re-raise to be handled by the caller


async def vector_search(collection_name, query_vector, k=10):
    """Perform vector search using Qdrant asynchronously."""
    logger.debug(f"Performing Qdrant search in '{collection_name}' with k={k}")
    try:
        # Run the synchronous Qdrant search call in a separate thread
        results = await asyncio.to_thread(
            qdrant_client.search,
            collection_name=collection_name,
            query_vector=query_vector,
            limit=k # Use the passed k value
        )
        logger.debug(f"Qdrant search returned {len(results)} results from '{collection_name}'.")
        return results
    except Exception as e:
        logger.error(f"Error during Qdrant search in '{collection_name}': {e}")
        raise # Re-raise to be handled by the caller


async def search(query, collection_name, k=10):
    """Search for most similar paragraphs in a specific Qdrant collection."""
    logger.debug(f"Initiating search for collection '{collection_name}' with k={k}")
    try:
        query_embedding = await embed_query(query)
        results = await vector_search(collection_name, query_embedding, k) # Pass k here
        similar_datapoints = [
            (r.payload.get('text', ''), r.payload.get('original_id', ''), r.score)
            for r in results if r.payload # Ensure payload exists
        ]
        logger.debug(f"Extracted {len(similar_datapoints)} datapoints from '{collection_name}'.")
        return similar_datapoints
    except Exception as e:
        logger.error(f"Error in search function for '{collection_name}': {e}")
        return [] # Return empty list on error within this function


async def search_both_datasets(query, k=10, scope='all'):
    """Search datasets (Qdrant collections) concurrently based on scope."""
    tasks = []
    logger.info(f"Searching datasets with scope: '{scope}', k={k} per dataset.")
    # Conditionally add search tasks based on the scope
    if scope == 'all' or scope == 'aurobindo':
        logger.debug(f"Adding search task for dataset: {dataset_identifier1} (Aurobindo)")
        tasks.append(search(query, dataset_identifier1, k)) # Pass k here
    if scope == 'all' or scope == 'mother':
        logger.debug(f"Adding search task for dataset: {dataset_identifier2} (Mother)")
        tasks.append(search(query, dataset_identifier2, k)) # Pass k here

    if not tasks:
         logger.warning(f"No datasets selected for scope '{scope}'. Returning empty results.")
         return []

    try:
        # Use asyncio.gather to run selected searches in parallel
        logger.debug(f"Running {len(tasks)} search tasks concurrently.")
        results_list = await asyncio.gather(*tasks)
        logger.debug("Search tasks completed.")
    except Exception as e:
        logger.error(f"Error during concurrent dataset search: {e}")
        return [] # Return empty list if gathering tasks fails

    # Combine the results from the executed tasks into a single list
    combined_results = []
    for result_set in results_list:
        combined_results.extend(result_set)
    logger.info(f"Combined {len(combined_results)} initial results from scope '{scope}'.")
    return combined_results


async def re_rank_results(query, results):
    """Re-rank the combined search results using Cohere's async rerank endpoint."""
    if not results:
        logger.info("No results provided to re_rank_results.")
        return []
    logger.info(f"Reranking {len(results)} results.")
    documents = [r[0] for r in results if r and isinstance(r, tuple) and len(r) > 0] # Ensure text exists

    if not documents:
        logger.warning("No valid documents found in results for reranking.")
        return []

    try:
        response = await co.rerank(
            model="rerank-v3.5", # Using the specified rerank model
            query=query,
            documents=documents,
            top_n=len(documents) # Rerank all provided valid documents
        )
        logger.info(f"Cohere rerank successful, received {len(response.results)} reranked items.")
    except Exception as e:
        logger.error(f"Error during Cohere rerank API call: {e}")
        # Returning empty list on rerank failure. Consider alternative strategies if needed.
        return []

    reranked_results = []
    original_indices_used = set() # To track which original results are mapped

    for rr in response.results:
        try:
            doc_index = rr.index # This index refers to the 'documents' list passed to co.rerank
            # Find the corresponding original result tuple. This assumes 'documents' list maps 1:1
            # We need to be careful if filtering happened before creating 'documents'
            # Let's find the original result based on the text content if indices are unreliable
            # This is less efficient but more robust if filtering occurred.
            # A better approach might be to pass indices along.
            # Assuming simple 1:1 mapping for now:
            if doc_index < len(results):
                 # Check if this original index has already been used (handles potential duplicate texts)
                 if doc_index not in original_indices_used:
                     original_result = results[doc_index]
                     if isinstance(original_result, tuple) and len(original_result) >= 3:
                         text, original_id, initial_confidence = original_result[:3]
                         relevance_score = rr.relevance_score
                         reranked_results.append((text, original_id, initial_confidence, relevance_score))
                         original_indices_used.add(doc_index)
                     else:
                          logger.warning(f"Original result at index {doc_index} has unexpected format: {original_result}")
                 else:
                     logger.warning(f"Original index {doc_index} already used in reranking. Skipping duplicate.")

            else:
                 logger.warning(f"Rerank index {doc_index} is out of bounds for original results list (len={len(results)}).")

        except Exception as e:
            # Catch potential errors during processing of individual reranked results
            logger.error(f"Error processing reranked result item {rr}: {e}")
            continue # Skip this item and continue with others

    logger.info(f"Successfully processed {len(reranked_results)} reranked results.")
    return reranked_results


async def load_metadata(search_id):
    """Load metadata for a given search_id from the merged_auromira.jsonl file."""
    logger.debug(f"Loading metadata for search_id: {search_id}")
    # Define the synchronous function to perform file I/O
    def find_entry():
        path = METADATA_FILE_PATH
        if not os.path.exists(path):
            logger.error(f"Metadata file not found at {path} for search_id: {search_id}")
            return {} # Return empty dict if file not found

        try:
            with open(path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    try:
                        entry = json.loads(line)
                        if entry.get('search_id') == search_id:
                            logger.debug(f"Found metadata for {search_id} at line {line_num}")
                            book_title = entry.get('book_title', 'N/A').strip()
                            # Construct the expected HTML file path based on the book title
                            # Ensure base path is correct for your deployment
                            html_base_path = "/home/olier/Olierclone/www/static/HTML"
                            file_path = os.path.join(html_base_path, f"{book_title}_modified.html")
                            # Basic check if constructed path looks reasonable (optional)
                            # if not os.path.exists(os.path.dirname(file_path)):
                            #     logger.warning(f"Calculated HTML directory does not exist: {os.path.dirname(file_path)}")

                            return {
                                "author": entry.get('author', 'N/A'),
                                "book_title": book_title,
                                "chapter_title": entry.get('chapter_title', 'N/A'),
                                "file_path": file_path # Return the constructed path
                            }
                    except json.JSONDecodeError:
                        logger.warning(f"Skipping invalid JSON line {line_num} in {path}")
                        continue
        except Exception as e:
            logger.error(f"Error reading metadata file {path}: {e}")
            return {} # Return empty on file read error
        logger.debug(f"Metadata not found for search_id: {search_id} in {path}")
        return {} # Return empty dict if search_id not found

    # Run the synchronous file reading function in a separate thread
    try:
        metadata = await asyncio.to_thread(find_entry)
        return metadata
    except Exception as e:
        logger.error(f"Error running find_entry in thread for search_id {search_id}: {e}")
        return {}


async def search_and_rank(query, scope='all'): # Removed default k here
    """
    Main function called by the /api/search endpoint.
    Searches datasets based on scope (with adjusted k), re-ranks results, fetches metadata.
    """
    logger.info(f"Starting search_and_rank for query: '{query[:50]}...' with scope: '{scope}'")

    # *** NEW: Determine k based on scope ***
    if scope == 'all':
        k_to_fetch = 7
        expected_max_results = k_to_fetch * 2
        logger.info(f"Scope is 'all', setting k_to_fetch = {k_to_fetch} per dataset.")
    elif scope == 'aurobindo' or scope == 'mother':
        k_to_fetch = 14
        expected_max_results = k_to_fetch
        logger.info(f"Scope is '{scope}', setting k_to_fetch = {k_to_fetch} for single dataset.")
    else:
        logger.warning(f"Invalid scope '{scope}' received in search_and_rank. Defaulting to 'all' behavior.")
        k_to_fetch = 7 # Default k for 'all' scope if scope is invalid
        expected_max_results = k_to_fetch * 2
        scope = 'all' # Force scope to 'all' if invalid value was passed
    # *** End NEW ***

    # 1. Perform initial vector search based on scope and calculated k
    initial_results = await search_both_datasets(query, k=k_to_fetch, scope=scope) # Use k_to_fetch
    total_results = len(initial_results)

    if total_results == 0:
        logger.info("No initial results found from vector search.")
        return []

    # Optional: Log if fewer results than expected are found
    if total_results < expected_max_results:
         logger.info(f"Note: Found {total_results} initial results (expected max {expected_max_results} for scope '{scope}' with k={k_to_fetch}).")

    # 2. Re-rank the combined initial results using Cohere
    final_results = await re_rank_results(query, initial_results)
    if not final_results:
         logger.info("No results returned after re-ranking.")
         return []

    # 3. Fetch metadata for each re-ranked result concurrently
    logger.info(f"Fetching metadata for {len(final_results)} reranked results.")
    metadata_tasks = [load_metadata(r[1]) for r in final_results if isinstance(r, tuple) and len(r) > 1] # r[1] is the search_id
    if not metadata_tasks:
         logger.warning("No valid search_ids found in reranked results to fetch metadata.")
         # Decide whether to return results without metadata or empty
         # Returning empty for now as metadata seems crucial
         return []

    try:
        metadata_list = await asyncio.gather(*metadata_tasks)
        logger.info("Metadata fetching complete.")
    except Exception as e:
        logger.error(f"Error gathering metadata: {e}")
        # Returning empty list as metadata fetching failed.
        return []


    # 4. Combine results with metadata and format the output
    logger.info("Formatting final results with metadata.")
    ranked_results = []
    # Ensure metadata_list has the same length as final_results after potential errors in gather
    if len(metadata_list) != len(final_results):
         logger.warning(f"Mismatch between number of final results ({len(final_results)}) and fetched metadata ({len(metadata_list)}). Formatting based on available metadata.")
         # Adjust loop range if necessary, or handle potential index errors
         min_len = min(len(final_results), len(metadata_list))
    else:
         min_len = len(final_results)


    for idx in range(min_len):
         result_tuple = final_results[idx]
         metadata = metadata_list[idx]

         # Check if result_tuple has the expected number of elements before unpacking
         if isinstance(result_tuple, tuple) and len(result_tuple) == 4:
             text, search_id, initial_confidence, relevance_score = result_tuple

             # Ensure scores are floats, handle None
             ic = float(initial_confidence) if initial_confidence is not None else 0.0
             rs = float(relevance_score) if relevance_score is not None else 0.0

             # Append the formatted result dictionary to the list
             ranked_results.append({
                 "rank": idx + 1, # 1-based rank
                 "text": text,
                 "search_id": search_id,
                 "initial_confidence": ic, # Original Qdrant score
                 "relevance_score": rs, # Cohere rerank score
                 "author": metadata.get('author', 'N/A'),
                 "book_title": metadata.get('book_title', 'N/A'),
                 "chapter_title": metadata.get('chapter_title', 'N/A'),
                 "file_path": metadata.get('file_path', 'N/A') # Path constructed in load_metadata
             })
         else:
              logger.warning(f"Skipping result at index {idx} due to unexpected format: {result_tuple}")

    logger.info(f"Search and rank complete. Returning {len(ranked_results)} formatted results.")
    return ranked_results

