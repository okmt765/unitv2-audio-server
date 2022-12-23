import audioop
import subprocess
import time

import uvicorn
from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import FileResponse

CHUNK = 1024 * 1
COMMAND = ['arecord', '-D', 'mixin', '-f', 'S16_LE', '-c', '1', '-r', '48000', '-t', 'raw', '-q', '-']
AUDIO_SOURCE = subprocess.Popen(COMMAND, stdout=subprocess.PIPE)


app = FastAPI()


@app.get('/')
async def get_index_html():
    return FileResponse('index.html')


@app.get('/script.js')
async def get_script_js():
    return FileResponse('script.js')


@app.websocket('/websocket')
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    key = websocket.headers.get('sec-websocket-key', '')
    print(f'WebSocket {key} connected')

    while True:
        if AUDIO_SOURCE.poll() is not None:
            await websocket.close()
            print(f'WebSocket {key} closed')
            break

        AUDIO_SOURCE.stdout.flush()
        buf = AUDIO_SOURCE.stdout.read(CHUNK)
        try:
            await websocket.send_bytes(buf)
        except Exception as e:
            await websocket.close()
            print(f'WebSocket {key} closed: {e}')
            break


if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8888)
