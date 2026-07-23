import { DesignPage } from '@/components/design-page';

export default function WeeklyEmptyScreen() {
  return (
    <DesignPage
      title="本周约定"
      step="08 / 16"
      badge="空状态"
      heroTitle="这周还没有和世界的约定"
      heroBody="抽一个盲盒，把“想出去”变成一个真的会发生的小计划。"
      metrics={[
        { label: '本周约定', value: '0 个' },
        { label: '可用抽卡', value: '3 次' },
      ]}
      sections={[
        {
          title: '你可能会喜欢',
          items: ['🌉 落日天桥：免费 · 拍照机位', '🍜 深夜小面馆：¥30 · 治愈'],
          tone: 'sky',
        },
      ]}
      primary={{ label: '去抽一个约定', href: '/preferences' }}
      secondary={{ label: '回到首页', href: '/' }}
    />
  );
}
