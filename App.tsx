import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, Dimensions, Platform } from 'react-native';
import { VolumeManager } from 'react-native-volume-manager';
import { useKeepAwake } from 'expo-keep-awake';

// Estructura de cada Split guardado
interface SplitRecord {
  id: number;
  cumulativeTime: string; // Tiempo total desde el inicio hasta este split
  lapTime: string;        // Tiempo intermedio (diferencia con el split anterior)
}

export default function App() {
  // Mantiene la pantalla encendida permanentemente mientras la app está abierta
  useKeepAwake();

  // Estados del Cronómetro (Solo para repintar la UI)
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [time, setTime] = useState<number>(0);
  const [splits, setSplits] = useState<SplitRecord[]>([]);

  // Referencias críticas de estado (Evitan el congelamiento en el listener nativo)
  const isRunningRef = useRef<boolean>(false);
  const timeRef = useRef<number>(0);

  // Referencias para la lógica de precisión mecánica
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const splitsRef = useRef<SplitRecord[]>([]);
  const lastSplitTimeRef = useRef<number>(0);
  
  // Control de rebote (Debounce) para botones físicos (en milisegundos)
  const lastButtonPressRef = useRef<number>(0);
  const DEBOUNCE_DELAY = 220; 

  // Sincronizar referencias auxiliares de inmediato ante cualquier cambio
  useEffect(() => {
    splitsRef.current = splits;
  }, [splits]);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  // Ciclo de vida principal: El listener se monta UNA SOLA VEZ []
  useEffect(() => {
    // Desactiva la barra visual de volumen del sistema
    VolumeManager.showNativeVolumeUI({ enabled: false });

    // 1. Fijamos el volumen a exactamente la mitad (0.5) como ancla
    VolumeManager.setVolume(0.5);

    const subscription = VolumeManager.addVolumeListener((result) => {
      const newVolume = result.volume;

      // 2. Si el evento detecta que el volumen es 0.5, es nuestro propio reseteo; lo ignoramos
      if (newVolume === 0.5) return;

      const now = Date.now();
      
      // Control de micro-pulsaciones falsas (rebote del botón físico)
      if (now - lastButtonPressRef.current < DEBOUNCE_DELAY) {
        VolumeManager.setVolume(0.5); // Mantenemos el ancla forzada
        return;
      }
      
      lastButtonPressRef.current = now;

      // 3. Evaluamos si el volumen subió o bajó respecto al 50%
      if (newVolume > 0.5) {
        handleStartStop();
      } else if (newVolume < 0.5) {
        handleSplitOrReset();
      }

      // 4. Inmediatamente devolvemos el volumen al 50%
      // Así garantizamos margen infinito de pulsaciones arriba o abajo
      VolumeManager.setVolume(0.5);
    });

    return () => {
      subscription.remove();
      VolumeManager.showNativeVolumeUI({ enabled: true });
    };
  }, []);

  // Bucle de renderizado continuo a 60fps
  const updateTimer = () => {
    const now = performance.now();
    const totalElapsed = now - startTimeRef.current + elapsedTimeRef.current;
    setTime(totalElapsed);
    animationFrameRef.current = requestAnimationFrame(updateTimer);
  };

  const handleStartStop = () => {
    // Leemos y cambiamos la referencia nativa primero
    if (!isRunningRef.current) {
      // START
      startTimeRef.current = performance.now();
      isRunningRef.current = true;
      setIsRunning(true);
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    } else {
      // STOP
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      elapsedTimeRef.current = timeRef.current;
      isRunningRef.current = false;
      setIsRunning(false);
    }
  };

  const handleSplitOrReset = () => {
    if (isRunningRef.current) {
      // ACCIÓN: SPLIT
      const currentTotalTime = timeRef.current;
      const formattedCumulative = formatTime(currentTotalTime);
      
      const lapTimeMs = currentTotalTime - lastSplitTimeRef.current;
      const formattedLap = formatTime(lapTimeMs);

      lastSplitTimeRef.current = currentTotalTime;

      const newSplit: SplitRecord = {
        id: splitsRef.current.length + 1,
        cumulativeTime: formattedCumulative,
        lapTime: formattedLap,
      };

      setSplits([newSplit, ...splitsRef.current]);
    } else {
      // ACCIÓN: RESET (Solo si está en pausa)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setTime(0);
      elapsedTimeRef.current = 0;
      lastSplitTimeRef.current = 0;
      setSplits([]);
    }
  };

  // Conversor a formato natación (MM:SS.cc)
  const formatTime = (timeInMs: number): string => {
    if (timeInMs < 0) timeInMs = 0;
    
    const minutes = Math.floor(timeInMs / 60000);
    const seconds = Math.floor((timeInMs % 60000) / 1000);
    const centiseconds = Math.floor((timeInMs % 1000) / 10);

    const pad = (num: number) => String(num).padStart(2, '0');

    return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Marcador Principal */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(time)}</Text>
        <Text style={styles.hintText}>
          {isRunning ? "▲ Vol: STOP  |  ▼ Vol: SPLIT" : "▲ Vol: START  |  ▼ Vol: RESET"}
        </Text>
      </View>

      {/* Tabla de Parciales */}
      <View style={styles.listContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 1 }]}>Nº</Text>
          <Text style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}>Parcial (Lap)</Text>
          <Text style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}>Total Acum.</Text>
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {splits.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.rowCell, { flex: 1, color: '#8E8E93' }]}>#{item.id}</Text>
              <Text style={[styles.rowCell, { flex: 2, textAlign: 'right', fontWeight: '600', color: '#30D158' }]}>
                {item.lapTime}
              </Text>
              <Text style={[styles.rowCell, { flex: 2, textAlign: 'right' }]}>
                {item.cumulativeTime}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  timerContainer: {
    flex: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  timerText: {
    fontSize: Dimensions.get('window').width * 0.16,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '300',
  },
  hintText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 15,
    letterSpacing: 1,
  },
  listContainer: {
    flex: 2,
    backgroundColor: '#1C1C1E',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
  },
  headerCell: {
    color: '#AEAEB2',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    alignItems: 'center',
  },
  rowCell: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});