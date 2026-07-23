import { useLocalSearchParams } from 'expo-router';

import { DesignPage } from '@/components/design-page';

export default function ReviewStatusScreen() {
  const params = useLocalSearchParams<{ attachmentCount?: string; textLength?: string }>();
  const attachmentCount = Number.parseInt(
    Array.isArray(params.attachmentCount) ? params.attachmentCount[0] : params.attachmentCount ?? '0',
    10,
  );
  const textLength = Number.parseInt(
    Array.isArray(params.textLength) ? params.textLength[0] : params.textLength ?? '0',
    10,
  );

  return (
    <DesignPage
      title="审核状态"
      step="07 / 16"
      badge="⏳"
      heroTitle="正在确认约定中"
      heroBody="审核通过后，约定会进入历史记录，并升级头衔。"
      metrics={[
        { label: '完成照片', value: `${attachmentCount || 0} 张` },
        { label: '感受文字', value: `${textLength || 0} 字` },
      ]}
      sections={[
        {
          title: '审核内容',
          items: [
            `☕ 完成照片：已上传 ${attachmentCount || 0} 张，等待系统确认。`,
            `✍ 感受文字：已记录 ${textLength || 0} 字，可同步到我的日记。`,
          ],
          tone: 'primary',
        },
      ]}
      primary={{ label: '返回本周约定', href: '/todos' }}
      secondary={{ label: '查看我的日记', href: '/my-diary' }}
    />
  );
}
