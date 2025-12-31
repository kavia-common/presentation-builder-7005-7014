#!/bin/bash
cd /home/kavia/workspace/code-generation/presentation-builder-7005-7014/ppt_generator_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

