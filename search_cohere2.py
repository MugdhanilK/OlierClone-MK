import numpy as np
import cohere
import toml
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

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    print("QDRANT_URL or QDRANT_API_KEY environment variables not set.")
    sys.exit(1)

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60.0)

dataset_identifier1 = 'aurocoherecomplete'
dataset_identifier2 = 'mothercoherecomplete'

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
    results = await asyncio.to_thread(
        qdrant_client.search,
        collection_name=collection_name,
        query_vector=query_vector,
        limit=k
    )
    return results

async def search(query, collection_name, k=10):
    """Search for most similar paragraphs to the query in a Qdrant collection."""
    query_embedding = await embed_query(query)
    results = await vector_search(collection_name, query_embedding, k)
    similar_datapoints = [
        (r.payload.get('text', ''), r.payload.get('original_id', ''), r.score)
        for r in results
    ]
    return similar_datapoints

async def search_both_datasets(query, k=10):
    """Search both datasets concurrently."""
    results1, results2 = await asyncio.gather(
        search(query, dataset_identifier1, k),
        search(query, dataset_identifier2, k)
    )
    return results1 + results2

async def re_rank_results(query, results):
    """
    Re-rank the results using Cohere's async rerank endpoint.
    results: list of (text, original_id, initial_confidence)
    """
    documents = [r[0] for r in results]  # Extract the text from each result

    response = await co.rerank(
        model="rerank-v3.5",
        query=query,
        documents=documents,
        top_n=len(documents)
    )

    reranked_results = []
    for rr in response.results:
        doc_index = rr.index
        text, original_id, initial_confidence = results[doc_index]
        relevance_score = rr.relevance_score
        reranked_results.append((text, original_id, initial_confidence, relevance_score))

    return reranked_results

async def load_metadata(search_id):
    """Load metadata from merged_auromira.jsonl."""
    def find_entry():
        path = '/home/olier/Olierclone/merged_auromira.jsonl'
        if not os.path.exists(path):
            return {}
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                entry = json.loads(line)
                if entry['search_id'] == search_id:
                    book_title = entry.get('book_title', 'N/A').strip()
                    file_path = f"/home/olier/Olierclone/www/static/HTML/{book_title}_modified.html"
                    return {
                        "author": entry.get('author', 'N/A'),
                        "book_title": book_title,
                        "chapter_title": entry.get('chapter_title', 'N/A'),
                        "file_path": file_path
                    }
        return {}

    return await asyncio.to_thread(find_entry)

async def search_and_rank(query, k=7):
    """Search both datasets and re-rank the results using Cohere's rerank endpoint."""
    initial_results = await search_both_datasets(query, k)
    total_results = len(initial_results)

    if total_results == 0:
        return []

    if total_results < 20:
        print(f"Warning: Only {total_results} results found across both datasets.")

    final_results = await re_rank_results(query, initial_results)

    metadata_tasks = [load_metadata(r[1]) for r in final_results]
    metadata_list = await asyncio.gather(*metadata_tasks)

    ranked_results = []
    for idx, ((text, search_id, initial_confidence, relevance_score), metadata) in enumerate(zip(final_results, metadata_list)):
        ic = float(initial_confidence)
        rs = float(relevance_score)

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

    return ranked_results
