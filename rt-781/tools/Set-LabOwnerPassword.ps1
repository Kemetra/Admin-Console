# RT-781 lab only (owner-approved 2026-10-23): set a NEW password for the rt9 lab Owner user b74f1728.
# Run by the OWNER. The password is read from your keyboard, hashed with argon2id by the api's own
# argon2@0.44.0 (m=19456,t=2,p=1) inside rt9-api via stdin; only the hash is written to the DB.
# -TestValue X : dry run (hash X, print the prefix, change nothing).
param([string]$TestValue)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$js = "eval(Buffer.from('Ly8gUlQtNzgxIGxhYjogcmVhZCBhIHBhc3N3b3JkIG9uIHN0ZGluLCBwcmludCBpdHMgYXJnb24yaWQgaGFzaCB3aXRoIHRoZSBhcGkncyBvd24gbGlicmFyeSBhbmQgcGFyYW1ldGVycy4KY29uc3QgYXJnb24yID0gcmVxdWlyZSgnL2FwcC9ub2RlX21vZHVsZXMvLnBucG0vYXJnb24yQDAuNDQuMC9ub2RlX21vZHVsZXMvYXJnb24yJyk7CmxldCBpbnB1dCA9ICcnOwpwcm9jZXNzLnN0ZGluLm9uKCdkYXRhJywgKGQpID0+IHsgaW5wdXQgKz0gZDsgfSkub24oJ2VuZCcsIGFzeW5jICgpID0+IHsKICBjb25zdCBwYXNzd29yZCA9IGlucHV0LnJlcGxhY2UoL1xyP1xuJC8sICcnKTsKICBjb25zdCBoYXNoID0gYXdhaXQgYXJnb24yLmhhc2gocGFzc3dvcmQsIHsgdHlwZTogYXJnb24yLmFyZ29uMmlkLCBtZW1vcnlDb3N0OiAxOTQ1NiwgdGltZUNvc3Q6IDIsIHBhcmFsbGVsaXNtOiAxIH0pOwogIGlmICghKGF3YWl0IGFyZ29uMi52ZXJpZnkoaGFzaCwgcGFzc3dvcmQpKSkgcHJvY2Vzcy5leGl0KDIpOwogIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGhhc2gpOwp9KTsK','base64').toString())"  # argon-hash.js, base64 (rootfs is read-only)
if ($TestValue) { $pa = $TestValue } else {
  $a = Read-Host -AsSecureString 'New lab Owner password (12+ characters)'
  $b = Read-Host -AsSecureString 'Repeat it'
  $pa = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($a))
  $pb = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($b))
  if ($pa -ne $pb) { throw 'The two entries differ; nothing changed.' }
  if ($pa.Length -lt 12) { throw 'Use at least 12 characters; nothing changed.' } }
$hash = [string](($pa | docker exec -i rt9-api node -e $js) -join '')
$pa = $null; $pb = $null
if ($LASTEXITCODE -ne 0 -or -not $hash.StartsWith('$argon2id$v=19$m=19456,t=2,p=1$') -or $hash.Length -lt 90) { throw "Hashing failed (exit $LASTEXITCODE); nothing changed." }
if ($TestValue) { "dry run ok: $($hash.Substring(0, 32))... length $($hash.Length); DB not changed"; return }
"update users set password_hash = '$hash', updated_at = now() where id = 'b74f1728-8240-48e8-b9e4-bf6a22130eaf' returning id, left(password_hash, 31) as hash_prefix, length(password_hash) as len;" |
  docker exec -i rt9-postgres psql -X -U rt9_owner -d rt9 -v ON_ERROR_STOP=1
$email = docker exec rt9-postgres psql -X -U rt9_owner -d rt9 -Atc "select email from users where id = 'b74f1728-8240-48e8-b9e4-bf6a22130eaf'"
"Done. Sign in at https://localhost:4781 as $email with the new password."
