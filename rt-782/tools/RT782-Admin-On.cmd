@echo off
rem RT-782 lab (owner-approved 2026-10-23, "Approve all" item 1): platform-admin flag ON for the lab Owner b74f1728. Revert: RT782-Admin-Off.cmd
echo update users set is_platform_admin = true, updated_at = now() where id = 'b74f1728-8240-48e8-b9e4-bf6a22130eaf' returning id, is_platform_admin, now(); | docker exec -i rt9-postgres psql -X -U rt9_owner -d rt9 -v ON_ERROR_STOP=1 > D:\rt9-lab\rt9rerun\782-admin-on.txt 2>&1
type D:\rt9-lab\rt9rerun\782-admin-on.txt
pause
