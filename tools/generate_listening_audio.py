#!/usr/bin/env python3

import argparse
import asyncio
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import edge_tts


def parse_args():
    parser = argparse.ArgumentParser(description="Generate one continuous MP3 for a listening exercise JSON.")
    parser.add_argument("input", type=Path, help="Exercise JSON file")
    parser.add_argument("-o", "--output", type=Path, default=None, help="Output MP3 path")
    parser.add_argument("--gap-ms", type=int, default=140, help="Silence between turns in milliseconds")
    return parser.parse_args()


def require(program: str):
    if shutil.which(program) is None:
        raise RuntimeError(f"Required executable not found: {program}")


async def synthesize_turn(text: str, entity: dict, output: Path):
    communicate = edge_tts.Communicate(
        text=text,
        voice=entity["voice"],
        rate=entity.get("rate", "+0%"),
        pitch=entity.get("pitch", "+0Hz"),
        volume=entity.get("volume", "+0%"),
    )
    await communicate.save(str(output))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


async def generate(exercise: dict, output: Path, gap_ms: int):
    require("ffmpeg")
    entities = exercise["entities"]
    transcript = exercise["transcript"]
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="listening_audio_") as tmp_name:
        tmp = Path(tmp_name)
        jobs = []
        turn_files = []

        for index, turn in enumerate(transcript, start=1):
            entity = entities[turn["entity"]]
            turn_file = tmp / f"turn_{index:03d}.mp3"
            turn_files.append(turn_file)
            jobs.append(synthesize_turn(turn["text"], entity, turn_file))

        await asyncio.gather(*jobs)

        concat_file = tmp / "concat.txt"
        silence_file = tmp / "silence.mp3"

        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"anullsrc=r=24000:cl=mono",
            "-t", f"{gap_ms / 1000:.3f}",
            "-q:a", "9", str(silence_file),
        ], check=True)

        lines = []
        for index, turn_file in enumerate(turn_files):
            lines.append(f"file '{turn_file.as_posix()}'")
            if index != len(turn_files) - 1 and gap_ms > 0:
                lines.append(f"file '{silence_file.as_posix()}'")
        concat_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat_file),
            "-c:a", "libmp3lame", "-b:a", "96k", str(output),
        ], check=True)

    checksum = sha256_file(output)
    checksum_path = output.with_name(output.name + ".sha256")
    checksum_path.write_text(f"{checksum}  {output.name}\n", encoding="utf-8")
    print(output)
    print(checksum_path)
    print(checksum)


async def main_async():
    args = parse_args()
    exercise = json.loads(args.input.read_text(encoding="utf-8"))
    output = args.output or Path("dist/audio") / f"{exercise['exerciseId']}.mp3"
    await generate(exercise, output, args.gap_ms)


if __name__ == "__main__":
    asyncio.run(main_async())
