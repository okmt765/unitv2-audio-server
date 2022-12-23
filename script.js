const { createApp } = Vue

createApp({
  data() {
    return {
      size: {
        width: document.body.offsetWidth,
        height: 350
      },
      svgFFT: {
        width: 1,
        path: '',
        running: false
      },
      svgRaw: {
        width: 1,
        path: '',
        running: true
      },
      audio: {
        ctx: null,
        volumeGain: 1.0,
        analyserGain: 1.0,
        analyser: null,
        volumeGainNode: null,
        analyserGainNode: null,
        initialDelay: 0,
        scheduledTime: 0
      },
      ws: null,
    }
  },
  mounted() {
    if (localStorage.volumeGain) {
      this.audio.volumeGain = localStorage.volumeGain;
    }
    if (localStorage.analyserGain) {
      this.audio.analyserGain = localStorage.analyserGain;
    }
  },
  computed: {
    svgFFTColor() {
      return this.svgFFT.running ? '#00F23E' : '#F23E00'
    },
    svgRawColor() {
      return this.svgRaw.running ? '#00F23E' : '#F23E00'
    }
  },
  created() {
    this.audio.ctx = new (window.AudioContext || window.webkitAudioContext);
    this.audio.volumeGainNode = this.audio.ctx.createGain();
    this.audio.analyserGainNode = this.audio.ctx.createGain();
    this.audio.analyser = this.audio.ctx.createAnalyser();
    this.audio.analyser.fftSize = 32768;

    this.audio.volumeGainNode.connect(this.audio.ctx.destination);
    this.audio.analyserGainNode.connect(this.audio.analyser);

    this.ws = new WebSocket('ws://' + document.location.host + '/websocket');
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => console.log('open');
    this.ws.onclose = () => console.log('close');
    this.ws.onerror = () => console.log(String(e));
    this.ws.onmessage = this.onMessage;

    window.addEventListener('beforeunload', this.unloadHandler)
    this.start();
  },
  destroyed() {
    window.removeEventListener('beforeunload', this.unloadHandler)
  },
  watch: {
    'audio.volumeGain'(newVolumeGain) {
      this.audio.volumeGainNode.gain.value = newVolumeGain;
      localStorage.volumeGain = newVolumeGain;
    },
    'audio.analyserGain'(newAnalyserGain) {
      this.audio.analyserGainNode.gain.value = newAnalyserGain;
      localStorage.analyserGain = newAnalyserGain;
    }
  },
  methods: {
    unloadHandler(event) {
      this.ws.close(1000, 'page unloaded');
    },
    onMessage(event) {
      if (event.data.constructor !== ArrayBuffer) throw 'expecting ArrayBuffer';
      const i16 = new Int16Array(event.data);
      const f32 = Float32Array.from(i16).map(v => { return v / 32767 });
      this.playAudioStream(f32);
    },
    playChunk(audioSrc) {
      if (audioSrc.start) {
        audioSrc.start(this.audio.scheduledTime);
      } else {
        audioSrc.noteOn(this.audio.scheduledTime);
      }
      audioSrc.onended = () => {
        audioSrc.disconnect();
      }
    },
    playAudioStream(audioF32) {
      var audioBuf = this.audio.ctx.createBuffer(1, audioF32.length, 48000);
      audioSrc = this.audio.ctx.createBufferSource();
      currentTime = this.audio.ctx.currentTime;

      audioBuf.getChannelData(0).set(audioF32);
      audioSrc.buffer = audioBuf;
      audioSrc.connect(this.audio.volumeGainNode);
      audioSrc.connect(this.audio.analyserGainNode);

      if (currentTime < this.audio.scheduledTime) {
        this.playChunk(audioSrc);
        this.audio.scheduledTime += audioBuf.duration;
      } else {
        this.playChunk(audioSrc);
        this.audio.scheduledTime = currentTime + audioBuf.duration + this.audio.initialDelay;
      }
    },
    start() {
      this.drawFFT();
      this.drawRaw();
    },
    drawFFT() {
      const bufferLength = this.audio.analyser.frequencyBinCount;

      const update = () => {
        const fftData = new Uint8Array(bufferLength);
        this.audio.analyser.getByteFrequencyData(fftData);

        let fftPath = 'M';
        fftData.forEach((p, i) => {
          const x = i * (this.size.width / bufferLength);
          const y = (255 - p) * this.size.height / 255;
          fftPath += `${x} ${y},`;
        });
        this.svgFFT.path = fftPath;

        if (this.svgFFT.running) {
          window.requestAnimationFrame(update.bind(this));
        }
      };

      window.requestAnimationFrame(update.bind(this));
    },
    drawRaw() {
      const bufferLength = this.audio.analyser.frequencyBinCount;

      const update = () => {
        const rawData = new Uint8Array(bufferLength);
        this.audio.analyser.getByteTimeDomainData(rawData);

        let rawPath = 'M';
        rawData.forEach((p, i) => {
          const x = i * (this.size.width / bufferLength);
          const y = p * this.size.height / 256;
          rawPath += `${x} ${y},`;
        });
        this.svgRaw.path = rawPath;

        if (this.svgRaw.running) {
          window.requestAnimationFrame(update.bind(this));
        }
      };

      window.requestAnimationFrame(update.bind(this));
    }
  }
}).mount('#app');
