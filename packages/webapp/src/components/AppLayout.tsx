import { ActionIcon, AppShell, Group, NavLink, Title, useMantineColorScheme } from '@mantine/core';
import {
  IconMoonStars,
  IconSun,
  IconHome,
  IconChartBar,
  IconList,
  IconCards,
  IconStairs,
  IconMap2,
  IconAlertTriangle,
  IconArrowsLeftRight,
} from '@tabler/icons-react';
import { Link, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useManifest } from '../hooks/useManifest';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'データセット', href: '/', icon: <IconHome size={18} /> },
  { label: 'ダッシュボード', href: '/dashboard', icon: <IconChartBar size={18} /> },
  { label: 'ラン一覧', href: '/runs', icon: <IconList size={18} /> },
  { label: 'カード分析', href: '/cards', icon: <IconCards size={18} /> },
  { label: 'ステージ分析', href: '/stages', icon: <IconStairs size={18} /> },
  { label: 'ヒートマップ', href: '/heatmap', icon: <IconMap2 size={18} /> },
  { label: 'エラー', href: '/errors', icon: <IconAlertTriangle size={18} /> },
  { label: '比較', href: '/compare', icon: <IconArrowsLeftRight size={18} /> },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const { data: manifest } = useManifest();
  const location = useLocation();

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm' }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Garden Gnome Analytics</Title>
          <Group>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="カラースキーム切替"
              onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
            >
              {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoonStars size={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            component={Link}
            to={item.href}
            label={item.label}
            leftSection={item.icon}
            active={
              item.href === '/'
                ? location.pathname === '/' || location.pathname === import.meta.env.BASE_URL
                : location.pathname.includes(item.href)
            }
          />
        ))}
        {manifest && (
          <NavLink
            label={`generated: ${new Date(manifest.generatedAt).toLocaleString('ja-JP')}`}
            disabled
            mt="lg"
            styles={{ label: { fontSize: 11 } }}
          />
        )}
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
