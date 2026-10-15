"""
Writes your MongoDB connection string into apps/api/.env, so you never edit it by hand.

Run:  npm run db:setup -w @goalpath/api

It asks for the string Atlas gave you, then (hidden) for the password, and fixes
special characters in the password for you. Nothing is sent anywhere: it only
writes the local, git-ignored .env file.
"""
import getpass
import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote

API_DIR = Path(__file__).resolve().parent.parent
# A second argument lets tests write somewhere else; normal use leaves it out.
ENV_FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else API_DIR / ".env"

USER_PLACEHOLDER = re.compile(r"<(db_)?username>", re.I)
PASS_PLACEHOLDER = re.compile(r"<(db_)?password>", re.I)


def fail(message: str) -> None:
    print(f"\nNothing was changed. {message}")
    sys.exit(1)


def main() -> None:
    print("Paste the connection string from Atlas (Connect > Drivers > Node.js).")
    print("It starts with mongodb+srv:// and may contain <db_password> or <password>.\n")
    uri = input("Connection string: ").strip().strip("'\"")

    if not re.match(r"^mongodb(\+srv)?://", uri):
        fail("That does not start with mongodb+srv://. Copy the whole string from Atlas.")

    if USER_PLACEHOLDER.search(uri):
        user = input("Database username: ").strip()
        if not user:
            fail("A username is needed.")
        uri = USER_PLACEHOLDER.sub(lambda _m: quote(user, safe=""), uri)

    if PASS_PLACEHOLDER.search(uri):
        password = getpass.getpass("Database password (hidden, nothing shows as you type): ")
        if not password:
            fail("A password is needed.")
        # Symbols such as @ # : / ? % would break the string, so they are encoded.
        uri = PASS_PLACEHOLDER.sub(lambda _m: quote(password, safe=""), uri)

    if "<" in uri or ">" in uri:
        fail("The string still has a < > placeholder in it. Paste the full string from Atlas again.")

    if not ENV_FILE.exists():
        shutil.copyfile(API_DIR / ".env.example", ENV_FILE)

    lines = ENV_FILE.read_text().splitlines()
    replaced = False
    for i, line in enumerate(lines):
        if re.match(r"^\s*MONGODB_URI\s*=", line):
            lines[i] = f"MONGODB_URI={uri}"
            replaced = True
    if not replaced:
        lines.append(f"MONGODB_URI={uri}")
    ENV_FILE.write_text("\n".join(lines) + "\n")
    os.chmod(ENV_FILE, 0o600)  # only you can read it

    host = re.sub(r"^mongodb(\+srv)?://[^@]*@", "", uri).split("/")[0].split("?")[0]
    print(f"\nSaved. The database address is {host}")
    print("Now test it:  npm run db:check -w @goalpath/api")


if __name__ == "__main__":
    main()
