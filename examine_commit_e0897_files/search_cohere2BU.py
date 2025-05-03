import numpy as np
import cohere
import toml
from sentence_transformers import CrossEncoder
import torch
import json
import asyncio
import os
import sys
import hashlib
from qdrant_client import QdrantClient

# Load API keys from TOML file
secrets = toml.load('/home/olier/DataGenResearch/Datagen/secrets.toml')
cohere_api_key = secrets["COHERE_API_KEY"]

# Initialize the Async Cohere client for reranking
co = cohere.AsyncClient(api_key=cohere_api_key)

# Initialize Qdrant Client from environment variables
QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    print("QDRANT_URL or QDRANT_API_KEY environment variables not set.")
    sys.exit(1)

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60.0)

# Dataset identifiers
dataset_identifier1 = 'aurocoherecomplete'
dataset_identifier2 = 'mothercoherecomplete'

# Initialize the CrossEncoder model with Sigmoid activation to get scores between 0 and 1
model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", default_activation_function=torch.nn.Sigmoid())

async def embed_query(query: str):
    """Embed the query using Cohere model with search_query input type."""
    # Directly await the async embed call
    response = await co.embed(
        model="embed-english-v3.0",
        input_type="search_query",
        texts=[query],
        truncate="NONE"
    )
    return np.array(response.embeddings[0])  # single query vector

async def vector_search(collection_name, query_vector, k=10):
    """Perform vector search using Qdrant."""
    # qdrant_client.search returns a list of records with 'id', 'score', 'payload'
    results = await asyncio.to_thread(
        qdrant_client.search,
        collection_name=collection_name,
        query_vector=query_vector,
        limit=k
    )
    return results

async def search(query, collection_name, k=10):
    """Search for the most similar paragraphs to the query in a specific Qdrant collection."""
    query_embedding = await embed_query(query)
    results = await vector_search(collection_name, query_embedding, k)
    # Qdrant returns a list of ScoredPoint: each has .payload, .id, .score
    # payload should contain {"original_id": ..., "text": ...}
    # We do not have 'distance' directly but 'score', which is similarity. 
    # Depending on vector parameters, this might be cosine similarity. 
    # If you need distance, you can convert from score if needed, but for re-ranking this might be fine as is.
    # We'll treat 'score' as initial_confidence.
    similar_datapoints = [
        (r.payload.get('text', ''), r.payload.get('original_id', ''), r.score)
        for r in results
    ]
    return similar_datapoints

async def search_both_datasets(query, k=10):
    """Search both datasets concurrently using asyncio.gather."""
    results1, results2 = await asyncio.gather(
        search(query, dataset_identifier1, k),
        search(query, dataset_identifier2, k)
    )
    # Combine the results from both collections
    return results1 + results2

async def re_rank_results(query, results):
    """Re-rank the results using CrossEncoder."""
    # results is a list of (text, original_id, initial_confidence)
    inputs = [(query, r[0]) for r in results]  # (query, text)
    scores = await asyncio.to_thread(model.predict, inputs)

    # Combine results with scores and sort by scores descending
    ranked = sorted(
        zip(results, scores),
        key=lambda x: x[1],
        reverse=True
    )

    # Correctly unpack the results
    return [(r[0], r[1], r[2], s) for r, s in ranked]


async def load_metadata(search_id):
    """Load metadata from the merged_auromira.jsonl file."""
    def find_entry():
        path = '/home/olier/oliertrial/dataset/merged_auromira.jsonl'
        if not os.path.exists(path):
            return {}
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                entry = json.loads(line)
                if entry['search_id'] == search_id:
                    book_title = entry.get('book_title', 'N/A').strip()
                    file_path = f"/home/olier/oliertrial/dataset/HTML/{book_title}_modified.txt"
                    return {
                        "author": entry.get('author', 'N/A'),
                        "book_title": book_title,
                        "chapter_title": entry.get('chapter_title', 'N/A'),
                        "file_path": file_path
                    }
        return {}

    return await asyncio.to_thread(find_entry)

async def search_and_rank(query, k=7):
    """Search using Cohere embeddings in both Qdrant collections and then re-rank the results."""
    initial_results = await search_both_datasets(query, k)

    total_results = len(initial_results)

    if total_results == 0:
        return []  # Return an empty list if no results are found

    if total_results < 20:
        print(f"Warning: Only {total_results} results found across both datasets.")

    # Re-rank results
    final_results = await re_rank_results(query, initial_results)

    # Load metadata
    metadata_tasks = [load_metadata(r[1]) for r in final_results]
    metadata_list = await asyncio.gather(*metadata_tasks)

    ranked_results = []
    error_filepath = '/home/olier/DataGenResearch/Datagen/Sources/AuroMira/JSON/nomicid_errors.txt'
    errors = []

    for idx, ((text, search_id, initial_confidence, relevance_score), metadata) in enumerate(zip(final_results, metadata_list)):
        # Debug prints
        print(f"DEBUG: Index={idx}, search_id={search_id}, initial_confidence={initial_confidence}, relevance_score={relevance_score}")

        # Attempt to convert confidence and score to float
        try:
            ic = float(initial_confidence)
            rs = float(relevance_score)
        except ValueError:
            # If conversion fails, log the error and skip this result
            error_msg = f"Non-numeric confidence/score at index {idx}, search_id={search_id}, initial_confidence={initial_confidence}, relevance_score={relevance_score}\n"
            errors.append(error_msg)
            continue

        ranked_results.append({
            "rank": idx + 1,
            "text": text,
            "search_id": search_id,
            "initial_confidence": ic,
            "relevance_score": rs,
            "author": metadata.get('author', 'N/A'),
            "book_title": metadata.get('book_title', 'N/A'),
            "chapter_title": metadata.get('chapter_title', 'N/A'),
            "file_path": metadata.get('file_path', 'N/A')
        })

    # If any errors were found, write them to the error file
    if errors:
        with open(error_filepath, 'a') as ef:
            ef.write("Non-numeric initial_confidence or relevance_score entries:\n")
            for err in errors:
                ef.write(err)
        print(f"Some entries had invalid confidence/score values. Check {error_filepath} for details.")

    return ranked_results
