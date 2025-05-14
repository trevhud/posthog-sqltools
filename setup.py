#!/usr/bin/env python3
"""
Setup script for PostHog ClickHouse Query Runner.
"""
# import os # This import is not used
import sys
import subprocess
from pathlib import Path

def main():
    """Set up the PostHog ClickHouse Query Runner."""
    print("Setting up PostHog ClickHouse Query Runner...")
    
    # Get the current directory
    current_dir = Path(__file__).parent.absolute()
    
    # Install Python dependencies
    print("\nInstalling Python dependencies...")
    requirements_file = current_dir / "requirements.txt"
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)])
        print("✅ Python dependencies installed successfully.")
    except subprocess.CalledProcessError:
        print("❌ Failed to install Python dependencies.")
        return 1
    
    # Check if .env file exists, if not create it
    env_file = current_dir / ".env"
    if not env_file.exists():
        print("\nCreating .env file...")
        api_key = input("Enter your PostHog API key: ")
        with open(env_file, "w") as f:
            f.write(f"POSTHOG_API_KEY={api_key}\n")
        print("✅ .env file created successfully.")
    else:
        print("\n✅ .env file already exists.")
    
    # Create queries directory if it doesn't exist
    queries_dir = current_dir / "queries"
    if not queries_dir.exists():
        print("\nCreating queries directory...")
        queries_dir.mkdir(exist_ok=True)
        print("✅ queries directory created successfully.")
    else:
        print("\n✅ queries directory already exists.")
    
    # Instructions for VSCode extension
    print("\n" + "-" * 50)
    print("Setup complete! To use the PostHog ClickHouse Query Runner:")
    print("1. Open VSCode")
    print("2. Open the posthog/extension folder")
    print("3. Press F5 to start debugging, which will launch a new VSCode window with the extension loaded")
    print("4. Create SQL files in the posthog/queries directory")
    print("5. Open a SQL file and press Command+Enter to run the query")
    print("-" * 50)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
