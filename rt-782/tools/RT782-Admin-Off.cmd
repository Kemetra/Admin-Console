@echo off
rem RT-782 lab revert of item 1: platform-admin flag back OFF for b74f1728.
echo update users set is_platform_admin = false, updated_at = now() where id = 'b74f1728-8240-48e8-b9e4-bf6a22130eaf' returning id, is_platform_admin, now(); | docker exec -i rt9-postgres psql -X -U rt9_owner -d rt9 -v ON_ERROR_STOP=1 > D:\rt9-lab\rt9rerun\782-admin-off.txt 2>&1
type D:\rt9-lab\rt9rerun\782-admin-off.txt
pause
