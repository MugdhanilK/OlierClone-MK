from locust import HttpUser, task, between
import json
import time
import urllib.parse

class UserBehavior(HttpUser):
    wait_time = between(1, 3)  # Each simulated user waits 1 to 3 seconds before making another request.

    # Predefined data
    chat_payload = {
        "messages": [
            {"role": "user", "content": "Hello, how can I find inner peace?"}
        ]
    }
    
    search_payload = {
        "query": "Integral Yoga"
    }
    
    keyword_search_payload = {
        "query": "Meditation"
    }
    
    # File path for full-text endpoint
    file_path = "Letters on Yoga IV_modified.html"
    encoded_file_path = urllib.parse.quote(file_path)

    @task(2)
    def search(self):
        # POST request to /api/search endpoint
        with self.client.post("/api/search", data=self.search_payload, catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f"Search failed with status {response.status_code}")

    @task(2)
    def chat(self):
        # Measure time to first token from /api/send-message
        start_time = time.time()
        with self.client.post("/api/send-message", json=self.chat_payload, catch_response=True, stream=True) as response:
            if response.status_code != 200:
                response.failure(f"Chat failed with status {response.status_code}")
            else:
                try:
                    # Read only the first chunk to measure initial token latency
                    first_chunk = next(response.iter_content(chunk_size=1024), None)
                except Exception as e:
                    response.failure(f"Error reading stream: {str(e)}")

        end_time = time.time()
        total_duration = end_time - start_time
        # Optionally print or log total_duration
        # print(f"Time to first chunk: {total_duration} seconds")

    @task(1)
    def keyword_search(self):
        # POST request to /api/keyword-search endpoint
        with self.client.post("/api/keyword-search", data=self.keyword_search_payload, catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f"Keyword search failed with status {response.status_code}")

    @task(1)
    def full_text_load(self):
        # GET request to /api/full-text endpoint
        url = f"/api/full-text?file_path={self.encoded_file_path}"
        with self.client.get(url, catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f"Full text load failed with status {response.status_code}")
