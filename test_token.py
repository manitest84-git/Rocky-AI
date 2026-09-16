import asyncio
from backend.auth import create_access_token
from backend.database import get_user_by_username, init_db

async def main():
    user = await get_user_by_username('admin')
    if user:
        token = create_access_token({"sub": user["username"], "user_id": user["id"], "role": user["role"]})
        print(f"TOKEN={token}")
    else:
        print("User not found")

if __name__ == "__main__":
    asyncio.run(main())
