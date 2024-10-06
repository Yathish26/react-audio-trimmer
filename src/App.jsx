import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { TypographyH2, TypographyP } from './components/typography'; 
import {
  Button,
  Container,
  MantineProvider,
  Text,
  Group,
  Box,
  Paper,
  LoadingOverlay,
} from '@mantine/core'; 
import { Region, WaveForm, WaveSurfer } from 'wavesurfer-react';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import '@mantine/core/styles.css';

function App() {
  const fileInputRef = useRef();
  const [audio, setAudio] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [regionData, setRegionData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const wavesurferRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());

  const load = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on('log', ({ message }) => {
      console.log(message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    setLoaded(true);

    console.log('FFmpeg is ready');
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (event) => {
    const file = event.target.files[0];
    console.log(file);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    setAudioUrl(URL.createObjectURL(file));

    if (file) {
      setAudio(file);
    }
  };

  const plugins = [
    {
      key: 'timeline',
      plugin: TimelinePlugin,
      options: {
        container: '#timeline',
      },
    },
    {
      key: 'regions',
      plugin: RegionsPlugin,
      options: { dragSelection: true },
    },
  ];

  const [regions, setRegions] = useState([
    {
      id: 'region-1',
      start: 0,
      end: 15,
      color: 'rgba(98, 86, 202, .5)',
      data: {
        systemRegionId: 33,
      },
    },
  ]);
  const regionsRef = useRef(regions);

  useEffect(() => {
    setRegionData(regions[0]);
  }, [regions]);

  const regionCreatedHandler = useCallback(
    (region) => {
      if (region.data.systemRegionId) return;

      setRegions([...regionsRef.current, { ...region, data: { ...region.data, systemRegionId: -1 } }]);
    },
    [regionsRef]
  );

  useEffect(() => {
    regionsRef.current = regions;
  }, [regions]);

  const handleWSMount = useCallback(
    (waveSurfer) => {
      wavesurferRef.current = waveSurfer;

      if (wavesurferRef.current) {
        wavesurferRef.current.on('region-created', regionCreatedHandler);

        wavesurferRef.current.on('ready', () => {
          setIsLoaded(true);
          setIsPlaying(true);

          regions.forEach((region) => {
            wavesurferRef.current.addRegion(region);
          });
        });
      }
    },
    [regionCreatedHandler, regions]
  );

  const handleRegionUpdate = useCallback((region) => {
    setRegionData(region);
    const start = region.start;
    wavesurferRef.current.seekTo(start / wavesurferRef.current.getDuration());
    wavesurferRef.current.play();
  }, []);

  useEffect(() => {
    if (!wavesurferRef.current) return;

    wavesurferRef.current.un('audioprocess');

    wavesurferRef.current.on('audioprocess', (time) => {
      if (time >= regionData.end) {
        wavesurferRef.current.seekTo(regionData.start / wavesurferRef.current.getDuration());
        wavesurferRef.current.pause();
        setIsPlaying(false);
      }
    });
  }, [regionData]);

  const play = useCallback(() => {
    wavesurferRef.current.playPause();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  async function trim() {
    if (!loaded) {
      console.error('FFmpeg is not loaded');
      return;
    }

    try {
      const ffmpeg = ffmpegRef.current;
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      await ffmpeg.writeFile('audio.mp3', new Uint8Array(arrayBuffer));

      await ffmpeg.exec(['-i', 'audio.mp3', '-ss', regionData.start.toString(), '-to', regionData.end.toString(), 'output.mp3']);

      const data = await ffmpeg.readFile('output.mp3');
      const blob = new Blob([data.buffer], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'output.mp3';
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      await ffmpeg.deleteFile('audio.mp3');
      await ffmpeg.deleteFile('output.mp3');
    } catch (error) {
      console.error('Error during trimming:', error);
    }
  }

  return (
    <MantineProvider
      theme={{
        colors: {
          purple: ['#f3e5f5', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a', '#4a148c'],
        },
        primaryColor: 'purple',
      }}
      withGlobalStyles
      withNormalizeCSS
    >
      <Container size="md" mt="xl">
        <Paper shadow="lg" p="xl" radius="md" style={{ backgroundColor: '#f0e6ff' }}>
          {!audio ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '300px',
                padding: '20px',
                border: '1px solid #CDC1FF',
                borderRadius: '8px',
                backgroundColor: '#F0F0FF',
              }}
            >
              <img style={{ width: '150px' }} src="src/assets/wave.svg" alt="" />
              <TypographyH2 text="Upload Audio" />
              <Text size="md" mt="sm" mb="lg" align="center">
                Select an audio file to upload and trim the audio as needed.
              </Text>
              <Button
                onClick={() => fileInputRef.current.click()}
                size="lg"
                variant="filled"
                color="violet"
                radius="xl"
              >
                Upload Audio
              </Button>
              <input
                onChange={handleChange}
                multiple={false}
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
              />
            </Box>

          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px', 
                padding: '20px',
                border: '1px solid #CDC1FF',
                borderRadius: '8px',
                backgroundColor: '#F0F0FF', 
              }}
            >
              <TypographyH2 text="Trim Audio" />
              <TypographyP text={`Audio file: ${audio.name}`} align="center" />

              <Box mt="md" sx={{ width: '100%' }}>
                <WaveSurfer
                  plugins={plugins}
                  onMount={handleWSMount}
                  cursorColor="transparent"
                  container="#waveform"
                  url={audioUrl}
                  waveColor={'#A594F9'}
                  barHeight={0.8}
                  progressColor={'#CDC1FF'}
                  barWidth={2}
                  dragToSeek={false}
                  autoplay={true}
                  interact={false}
                >
                  <WaveForm id="waveform" />
                  <div id="timeline" />
                  {isLoaded &&
                    regions.map((regionProps) => (
                      <Region
                        onUpdateEnd={handleRegionUpdate}
                        key={regionProps.id}
                        {...regionProps}
                      />
                    ))}
                </WaveSurfer>

                <Group position="center" mt="xl">
                  <Button onClick={play} size="lg" variant="filled" color="violet" radius="xl">
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button onClick={trim} size="lg" variant="filled" color="violet" radius="xl">
                    Trim Audio
                  </Button>
                </Group>
              </Box>
            </Box>
          )}
        </Paper>
      </Container>
    </MantineProvider>
  );
}

export default App;
