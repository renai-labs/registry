import os

from openai import OpenAI


def get_openai_client() -> OpenAI:
    base_url = os.getenv("LITELLM_PROXY_API_BASE", "http://localhost:4000")
    api_key = os.getenv("LITELLM_PROXY_API_KEY")
    return OpenAI(base_url=base_url, api_key=api_key)
