import { DesignPage } from '@/components/design-page';

export default function PlanDetailScreen() {
  return (
    <DesignPage
      title="方案详情"
      step="03 / 16"
      badge="可直接执行"
      heroTitle="河边旧书咖啡店轻出走"
      heroBody="把路线、预算、完成标准都收进一页，出门时只看这一页就够。"
      metrics={[
        { label: '集合方式', value: '地铁 + 步行' },
        { label: '完成标准', value: '一张照片' },
        { label: '适合天气', value: '阴 / 晴' },
        { label: '分享状态', value: '可邀请' },
      ]}
      sections={[
        {
          title: '行动路线',
          items: [
            '出发前：带一只帆布袋和耳机，保留 3 小时空档',
            '到达后：沿河走到第二座桥，再进入书店点一杯热饮',
            '离开前：拍下最想带走的一页书或窗边座位',
          ],
          tone: 'sky',
        },
        {
          title: '预算拆分',
          items: ['地铁往返约 12 元', '咖啡或茶饮约 36 元', '一本旧书预留 30 元'],
        },
        {
          title: '分享确认',
          body: '分享后朋友只能看到路线、时间和邀请语，不会看到你的历史偏好。',
          tag: '隐私安全',
          tone: 'green',
        },
      ]}
      primary={{ label: '加入本周约定', href: '/join-plan' }}
      secondary={{ label: '返回小卡', href: '/result-card' }}
    />
  );
}
