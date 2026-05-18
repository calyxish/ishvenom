/**
 * BiteTimer — live counter showing elapsed time since the bite.
 *
 * Ticks every second from encounter.createdAt.
 * Renders as: "TIME SINCE BITE: HH:MM:SS"
 * Uses monospace sizing and textMuted color as specified in the design system.
 */
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { formatElapsed } from '../lib/emergency';
import { useTheme } from '../hooks/useTheme';

interface Props {
  /** ISO-8601 timestamp — the moment the bite was recorded. */
  createdAt: string;
}

export function BiteTimer({ createdAt }: Props) {
  const { colors } = useTheme();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  return (
    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
      {'TIME SINCE BITE: '}
      <Text style={{ fontVariant: ['tabular-nums'] }}>{formatElapsed(elapsed)}</Text>
    </Text>
  );
}
