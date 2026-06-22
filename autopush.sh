#!/bin/bash
MSG=${1:-"auto: $(date '+%Y-%m-%d %H:%M')"}
git add -A
git commit -m "$MSG"
git push
