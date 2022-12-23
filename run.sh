#!/bin/sh

gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8888 -t 0
