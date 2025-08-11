@echo off

set REMOTE_PATH=~/JoeSite
set LOCAL_PATH=./.env

scp "%LOCAL_PATH%" YeCaoUS:%REMOTE_PATH%

pause