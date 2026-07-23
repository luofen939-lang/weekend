import { DesignPage } from '@/components/design-page';

export default function ResultCardScreen() {
  return (
    <DesignPage
      title="AI 小卡"
      step="02 / 16"
      badge="适合低电量出门"
      heroTitle="去河边旧书咖啡店，完成一次无目的散步"
      heroBody="不用做完整攻略，只要跟着一张小卡把今天交出去。"
      metrics={[
        { label: '预计时长', value: '2-3 小时' },
        { label: '单人预算', value: '50-100元' },
        { label: '出发距离', value: '24 分钟' },
        { label: '执行难度', value: '很轻松' },
      ]}
      sections={[
        {
          title: '路线摘要',
          body: '先沿河散步 20 分钟，再进旧书咖啡店坐下来，最后把今天看到的一个小细节写进日记。',
          tag: '今日推荐',
          tone: 'primary',
        },
        {
          title: '为什么推荐给你',
          items: ['你最近更偏好安静室内和短距离路线', '预算低、交通简单，适合临时出发', '可以自然产生日记素材'],
        },
      ]}
      primary={{ label: '查看完整方案', href: '/plan-detail' }}
      secondary={{ label: '重新选择偏好', href: '/preferences' }}
    />
  );
}
