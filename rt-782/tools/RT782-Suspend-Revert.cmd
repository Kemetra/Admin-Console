@echo off
rem RT-782 lab revert of item 3: test tenant back to active (it is then soft-deleted through the API).
echo update tenants set status = 'active', updated_at = now() where id = '01a16954-7925-7559-99ae-4db1a7981a9c' and slug = 'rt782-suspended-target' returning id, slug, status, now(); | docker exec -i rt9-postgres psql -X -U rt9_owner -d rt9 -v ON_ERROR_STOP=1 > D:\rt9-lab\rt9rerun\782-suspend-revert.txt 2>&1
type D:\rt9-lab\rt9rerun\782-suspend-revert.txt
pause
