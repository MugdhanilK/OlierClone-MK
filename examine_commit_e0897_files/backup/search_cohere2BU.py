import numpy as np
import cohere
import toml
from sentence_transformers import CrossEncoder
import torch
import nomic
from nomic import AtlasDataset
import json
import asyncio
import os

# Load API keys from TOML file
secrets = toml.load('/home/olier/DataGenResearch/Datagen/secrets.toml')
cohere_api_key = secrets["COHERE_API_KEY"]

# Initialize Cohere client and nomic
co = cohere.Client(cohere_api_key)
nomic_api = secrets["nomic_key"]
nomic.login(nomic_api)

# Initialize both datasets
dataset_identifier1 = 'aurocoherecomplete'
dataset_identifier2 = 'mothercoherecomplete'
dataset1 = AtlasDataset(dataset_identifier1)
dataset2 = AtlasDataset(dataset_identifier2)
map1 = dataset1.maps[0]
map2 = dataset2.maps[0]

# Initialize the CrossEncoder model with Sigmoid activation to get scores between 0 and 1
model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", default_activation_function=torch.nn.Sigmoid())

async def embed_query(query: str):
    """Embed the query using Cohere model with search_query input type."""
    # Run co.embed in a thread to avoid blocking
    response = await asyncio.to_thread(
        co.embed,
        model="embed-english-v3.0",
        input_type="search_query",
        texts=[query],
        truncate="NONE"
    )
    return np.array(response.embeddings)

async def vector_search(query_embedding, map, k=10):
    """Perform vector search using the embeddings map in a thread."""
    neighbors, distances = await asyncio.to_thread(map.embeddings.vector_search, queries=query_embedding, k=k)
    return neighbors[0], distances[0]

async def search(query, dataset, map, k=10):
    """Search for the most similar paragraphs to the query in a specific dataset."""
    query_embedding = await embed_query(query)
    neighbors, distances = await vector_search(query_embedding, map, k)
    # dataset.get_data is synchronous, run in a thread
    similar_datapoints = await asyncio.to_thread(dataset.get_data, ids=neighbors)
    results = [(entry['text'], entry['ID'], distance) for entry, distance in zip(similar_datapoints, distances)]
    return results

async def search_both_datasets(query, k=10):
    """Search both datasets concurrently using asyncio.gather."""
    # Run searches in parallel
    results1, results2 = await asyncio.gather(
        search(query, dataset1, map1, k),
        search(query, dataset2, map2, k)
    )
    return results1 + results2

async def re_rank_results(query, results):
    """Re-rank the results using CrossEncoder in a thread."""
    inputs = [(query, result[0]) for result in results]
    # model.predict is synchronous, run in a thread
    scores = await asyncio.to_thread(model.predict, inputs)
    ranked_results = [
        (result[0], result[1], result[2], score)
        for result, score in sorted(
            zip(results, scores),
            key=lambda x: x[1],
            reverse=True
        )
    ]
    return ranked_results

async def load_metadata(search_id):
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

    # Find_entry is a synchronous function
    return await asyncio.to_thread(find_entry)

async def search_and_rank(query, k=7):
    """Search using Cohere embeddings in both datasets and then re-rank the results."""
    initial_results = await search_both_datasets(query, k)

    # Check the number of results
    total_results = len(initial_results)

    if total_results == 0:
        return []  # Return an empty list if no results are found

    if total_results < 20:
        print(f"Warning: Only {total_results} results found across both datasets.")

    # Re-rank all available results
    final_results = await re_rank_results(query, initial_results)

    ranked_results = []
    # Load metadata for each result concurrently:
    # Create tasks for each metadata load
    metadata_tasks = [load_metadata(id) for (_, id, _, _) in final_results]
    metadata_list = await asyncio.gather(*metadata_tasks)

    for idx, ((text, id, distance, score), metadata) in enumerate(zip(final_results, metadata_list)):
        ranked_results.append({
            "rank": idx + 1,
            "text": text,
            "search_id": id,
            "initial_confidence": float(distance),
            "relevance_score": float(score),
            "author": metadata.get('author', 'N/A'),
            "book_title": metadata.get('book_title', 'N/A'),
            "chapter_title": metadata.get('chapter_title', 'N/A'),
            "file_path": metadata.get('file_path', 'N/A')
        })

    return ranked_results
