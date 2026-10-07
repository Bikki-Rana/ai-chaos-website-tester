import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.db.session import async_session_maker
from app.models.test_run import TestRun
from app.models.action import Action
from app.models.failure import Failure
from app.models.project import Project

async def seed():
    async with async_session_maker() as db:
        # 1. Create a dummy project & run
        proj = Project(name="Phase10 Test", url="http://localhost:5000")
        db.add(proj)
        await db.flush()
        
        run = TestRun(project_id=proj.id)
        db.add(run)
        await db.flush()

        # 2. Add some successful actions
        act1 = Action(test_run_id=run.id, action_type="navigate", target_selector="http://localhost:5000/cart", value=None, status="success")
        act2 = Action(test_run_id=run.id, action_type="click", target_selector="#apply-promo", value=None, status="success")
        db.add(act1)
        db.add(act2)
        await db.flush()

        # 3. Add a failure linked to this run
        fail = Failure(
            test_run_id=run.id,
            failure_type="js_error",
            message="TypeError: undefined is not a function",
            severity="high"
        )
        db.add(fail)
        await db.commit()

        print(f"SEEDED_FAILURE_ID={fail.id}")

if __name__ == "__main__":
    asyncio.run(seed())