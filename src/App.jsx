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
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);



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
      color: 'rgba(124, 0, 255, 0.4)',
      drag: true,
      resize: true,
      handleStyle: {
        left: 'rgba(98, 86, 202, 0.8)',
        right: 'rgba(98, 86, 202, 0.8)',
      },
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

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };


  const handleRegionUpdate = useCallback((region) => {
    setRegionData(region);
    setStartTime(formatTime(region.start));
    setEndTime(formatTime(region.end));
    setDuration(formatTime(region.end - region.start));
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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgb(124 0 255), rgb(237, 231, 246))',
        }}
      >
        <Container size="md" mt="xl">
          <Paper
            shadow="xl"
            p="xl"
            radius="lg"
            style={{
              background: 'linear-gradient(135deg, rgb(132 15 255);',
              border: '1px solid #E6E6FA',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
              maxWidth: '600px',
              margin: 'auto',
            }}
          >
            {!audio ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '350px',
                  padding: '25px',
                  border: '2px dashed #CDC1FF',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #f7f7ff, #ececff)',
                }}
              >
                <svg
                  width="120px"
                  height="120px"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3.5 25.018h9.877l2.277-10.973 2.278 20.162 2.277-25.145 2.278 29.876 2.277-29.745 2.278 27.235 2.277-25.406 2.278 18.756 2.277-16.217 2.278 11.363H44.5"
                    fill="none"
                    stroke="#000"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <TypographyH2
                  text="Upload Audio"
                  style={{ fontWeight: 'bold', color: '#7b1fa2' }}
                />
                <Text
                  size="md"
                  mt="sm"
                  mb="lg"
                  align="center"
                  style={{ color: '#7a7a7a' }}
                >
                  Select an audio file to upload and trim the audio as needed.
                </Text>
                <Button
                  onClick={() => fileInputRef.current.click()}
                  size="lg"
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'purple' }}
                  radius="xl"
                  sx={{ boxShadow: '0 4px 12px rgba(146, 118, 255, 0.5)' }}
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
                  minHeight: '450px',
                  padding: '25px',
                  border: '2px solid #CDC1FF',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #f0f0ff, #eaeaff)',
                }}
              >
                <TypographyH2
                  text="Trim Audio"
                  style={{ fontWeight: 'bold', color: '#7b1fa2' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg
                    width="24px"
                    height="24px"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14.319 2.505A2.75 2.75 0 0011.414 4.3c-.098.27-.132.563-.148.869A17.25 17.25 0 0011.25 6v8.536A4.75 4.75 0 1012.75 18V9.21c.105.056.218.113.343.175L15.8 10.74c.418.21.759.38 1.038.5.281.123.558.223.843.257A2.75 2.75 0 0020.586 9.7c.098-.27.132-.563.148-.87.016-.303.016-.683.016-1.151v-.083c0-.348 0-.62-.049-.878a2.75 2.75 0 00-1.03-1.667c-.21-.16-.453-.281-.764-.436L16.2 3.261c-.418-.21-.759-.38-1.038-.501-.28-.123-.558-.223-.843-.256z"
                      fill="#000"
                    />
                  </svg>
                  <TypographyP text={`${audio.name}`} align="center" style={{ color: '#6a1b9a' }} />
                </div>

                <Box mt="md" sx={{ width: '100%' }}>
                  <WaveSurfer
                    plugins={plugins}
                    onMount={handleWSMount}
                    cursorColor="transparent"
                    container="#waveform"
                    url={audioUrl}
                    waveColor={'#A594F9'}
                    barHeight={0.5}
                    progressColor={'#CDC1FF'}
                    barWidth={3}
                    dragToSeek={true}
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
                  <Group position="center" mt="md" justify="center">
                    <Text size="sm" color="dimmed">
                      Start Time: {startTime} seconds
                    </Text>
                    <Text size="sm" color="dimmed">
                      End Time: {endTime} seconds
                    </Text>
                    <Text size="sm" color="dimmed">
                      Duration: {duration} seconds
                    </Text>
                  </Group>

                  <Group position="center" mt="xl" justify="center">
                    <Button
                      onClick={play}
                      size="lg"
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'purple' }}
                      radius="xl"
                      sx={{ boxShadow: '0 4px 12px rgba(146, 118, 255, 0.5)' }}
                    >
                      Play / Pause
                    </Button>
                    <Button
                      onClick={trim}
                      size="lg"
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'purple' }}
                      radius="xl"
                      sx={{ boxShadow: '0 4px 12px rgba(146, 118, 255, 0.5)' }}
                    >
                      Trim Audio
                    </Button>
                  </Group>
                </Box>
              </Box>
            )}
          </Paper>
        </Container>
      </div>
    </MantineProvider>


  );
}

export default App;
