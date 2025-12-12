import argparse
import logging
from pathlib import Path

from loguru import logger

from horde_sdk import ANON_API_KEY
from horde_sdk.ai_horde_api import JobID
from horde_sdk.ai_horde_api.ai_horde_clients import AIHordeAPISimpleClient
from horde_sdk.ai_horde_api.apimodels import (
    ModelGenerationInputKobold,
    TextGenerateAsyncRequest,
    TextGenerateStatusResponse,
)


def check_callback(response: TextGenerateStatusResponse) -> None:
    """Callback function that can be passed to the text_generate_request method to get progress updates on the
    request."""
    if response.done:
        logger.info("Text generation completed!")
    elif response.waiting > 0:
        logger.info(f"Waiting in queue... Position: {response.queue_position}")
    else:
        logger.info("Processing request...")


def simple_generate_example(api_key: str = ANON_API_KEY) -> None:
    # Configure logging to reduce horde_sdk noise
    logging.getLogger("horde_sdk").setLevel(logging.WARNING)
    logger.info("Starting text generation request...")

    simple_client = AIHordeAPISimpleClient()

    status_response: TextGenerateStatusResponse
    job_id: JobID

    prompt = """
Write a short story or descriptive text at B1 English level (intermediate) about
everyday life, family, work, or hobbies. Make it suitable for language learners
to practice reading comprehension. Include natural vocabulary and grammar for
intermediate learners. Do not mention language levels or testing.

It must be 3 paragraphs long, with each paragraph containing 2 to 3 sentences.
"""

    status_response, job_id = simple_client.text_generate_request(
        TextGenerateAsyncRequest(
            apikey=api_key,
            prompt=prompt,
            models=[
                "aphrodite/ReadyArt/Broken-Tutu-24B",
            ],
            allow_downgrade=True,
            disable_batching=False,
            params=ModelGenerationInputKobold(
                dynatemp_exponent=1.0,
                dynatemp_range=0.0,
                # frmtadsnsp=False,
                # frmtrmblln=False,
                # frmtrmspch=False,
                # frmttriminc=False,
                max_context_length=4096,
                max_length=512,
                min_p=0.0,
                # n=1,
                # rep_pen=1.0,
                # rep_pen_range=0,
                # rep_pen_slope=0.0,
                # sampler_order=[1, 2, 3],
                # singleline=False,
                smoothing_factor=0.0,
                # stop_sequence=["stop1", "stop2"],
                # temperature=0.0,
                # tfs=0.0,
                # top_a=0.0,
                # top_k=0,
                # top_p=0.001,
                # typical=0.0,
                # use_default_badwordsids=True,
            ),
        ),
        # timeout=60*60*20, # time before cancelling the request; times out server side at 20 minutes by default
        check_callback=check_callback,
    )

    if len(status_response.generations) == 0:
        raise ValueError("No generations returned in the response.")

    logger.debug(f"Job ID: {job_id}")
    logger.debug(f"Response: {status_response}")

    text_generated = status_response.generations[0].text

    logger.debug(f"Generated Text: {text_generated}")

    # Save the response to file
    example_path = Path("requested_text")
    example_path.mkdir(exist_ok=True, parents=True)

    with open(example_path / f"{job_id}_simple_sync_example.txt", "w") as f:
        f.write(status_response.model_dump_json(indent=4))

    # Clear display of the generated text
    print("\n" + "=" * 60)
    print("GENERATED TEXT:")
    print("=" * 60)
    if text_generated:
        print(text_generated.strip())
    else:
        print("No text generated")
    print("=" * 60)
    print(f"Job ID: {job_id}")
    print(f"Model: {status_response.generations[0].model}")
    print(f"Kudos used: {status_response.kudos:.2f}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simple text generation example.")
    parser.add_argument(
        "--apikey",
        "--api-key",
        "-k",
        type=str,
        default=ANON_API_KEY,
        help="The API key to use for the request.",
    )

    args = parser.parse_args()

    simple_generate_example(args.apikey)
