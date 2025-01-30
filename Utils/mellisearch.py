import meilisearch
import json
import logging
import toml

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load secrets from toml file
secrets = toml.load('/home/olier/DataGenResearch/Datagen/secrets.toml')
FAL_KEY = secrets.get("FAL_KEY")
if not FAL_KEY:
    raise ValueError("FAL_KEY is not set in the secrets file")

# Initialize Meilisearch client
MEILISEARCH_URL = 'http://127.0.0.1:7700'  # Update if different
MEILI_INDEX_NAME = 'auromira4d_index'
DATASET_PATH = '/home/olier/Olierdev/merged_auromira.jsonl'


# If your Meilisearch instance requires an API key, uncomment and set it
# MEILISEARCH_API_KEY = secrets.get("MEILISEARCH_API_KEY")
# meili_client = meilisearch.Client(MEILISEARCH_URL, MEILISEARCH_API_KEY)

meili_client = meilisearch.Client(MEILISEARCH_URL)

def get_task_uid(task):
    if isinstance(task, dict):
        return task.get('taskUid') or task.get('uid') or task.get('task_uid')
    else:
        return getattr(task, 'task_uid', None) or getattr(task, 'uid', None) or getattr(task, 'taskUid', None)

def initialize_meilisearch():
    try:
        # Fetch existing indexes
        response = meili_client.get_indexes()
        index_names = []

        if isinstance(response, dict) and 'results' in response:
            # For newer versions: response is a dict with 'results' key
            for index in response['results']:
                if isinstance(index, dict):
                    index_names.append(index['uid'])
                else:
                    index_names.append(index.uid)
        elif isinstance(response, list):
            # For older versions: response is a list of Index objects
            for index in response:
                index_names.append(index.uid)
        else:
            logger.error("Unexpected response format from get_indexes()")
            index_names = []

        if MEILI_INDEX_NAME not in index_names:
            logger.info(f"Creating Meilisearch index: {MEILI_INDEX_NAME}")
            # Create index and wait for the task to complete
            task = meili_client.create_index(uid=MEILI_INDEX_NAME, options={'primaryKey': 'search_id'})
            task_uid = get_task_uid(task)
            if task_uid is None:
                logger.error("Could not find task UID in task object")
                return
            meili_client.wait_for_task(task_uid)

            index = meili_client.get_index(MEILI_INDEX_NAME)

            # Update searchable attributes and wait for the task
            task = index.update_searchable_attributes(['author', 'book_title', 'chapter_title', 'text'])
            task_uid = get_task_uid(task)
            if task_uid is None:
                logger.error("Could not find task UID in task object")
                return
            index.wait_for_task(task_uid)

            # Update displayed attributes and wait for the task
            task = index.update_displayed_attributes(['author', 'book_title', 'chapter_title', 'search_id', 'text'])
            task_uid = get_task_uid(task)
            if task_uid is None:
                logger.error("Could not find task UID in task object")
                return
            index.wait_for_task(task_uid)

            # Index documents in batches
            logger.info("Indexing documents into Meilisearch...")
            batch_size = 1000  # Adjust batch size as needed
            documents_batch = []
            with open(DATASET_PATH, 'r', encoding='utf-8') as file:
                for line_number, line in enumerate(file, start=1):
                    doc = json.loads(line)
                    documents_batch.append(doc)

                    if line_number % batch_size == 0:
                        task = index.add_documents(documents_batch)
                        logger.info(f"Task object received: {task}")
                        task_uid = get_task_uid(task)
                        if task_uid is None:
                            logger.error("Could not find task UID in task object")
                            return
                        index.wait_for_task(task_uid)
                        documents_batch = []
                        logger.info(f"Indexed {line_number} documents so far...")

                # Index any remaining documents
                if documents_batch:
                    task = index.add_documents(documents_batch)
                    task_uid = get_task_uid(task)
                    if task_uid is None:
                        logger.error("Could not find task UID in task object")
                        return
                    index.wait_for_task(task_uid)
                    logger.info(f"Indexed all {line_number} documents successfully!")
        else:
            logger.info(f"Meilisearch index '{MEILI_INDEX_NAME}' already exists.")
    except meilisearch.errors.MeilisearchApiError as e:
        logger.error(f"An error occurred during Meilisearch initialization: {e}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")

if __name__ == '__main__':
    initialize_meilisearch()
