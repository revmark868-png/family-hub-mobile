import { StatusBar } from 'expo-status-bar'
import { useMemo, useState } from 'react'
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

type TabKey = 'home' | 'upload' | 'family' | 'notifications' | 'menu'
type Locale = 'zh' | 'en'

const tabs: Array<{ key: TabKey; icon: string }> = [
  { key: 'home', icon: '⌂' },
  { key: 'upload', icon: '＋' },
  { key: 'family', icon: '♡' },
  { key: 'notifications', icon: '•' },
  { key: 'menu', icon: '☰' },
]

const copy = {
  zh: {
    appName: 'Family Hub',
    tagline: '把家人的日常，送到家里的记忆墙。',
    tabs: {
      home: '首页',
      upload: '上传',
      family: '家庭',
      notifications: '通知',
      menu: '菜单',
    },
    home: {
      title: '今天的家庭记忆',
      subtitle: '快速查看家庭状态、最近上传和家里屏幕是否正常。',
      primary: '上传新回忆',
      secondary: '邀请家人',
      cards: ['家庭屏幕已连接', '最近 3 条回忆', '待审核内容'],
    },
    upload: {
      title: '发送到家庭记忆墙',
      subtitle: '选择照片或视频，添加标题和备注，然后发送给家人。',
      steps: ['选择照片 / 视频', '预览与裁剪', '填写标题 / 备注', '显示上传进度'],
      primary: '选择媒体',
    },
    family: {
      title: '家庭成员与邀请',
      subtitle: '查看成员、分享邀请码、生成二维码，管理员可管理显示设备。',
      actions: ['复制邀请码', '分享邀请链接', '生成二维码', '显示设备入口'],
    },
    notifications: {
      title: '通知中心',
      subtitle: '集中查看新回忆、成员加入、审核提醒和显示设备状态。',
      items: ['新回忆提醒', '家人加入提醒', '上传审核提醒', '显示设备异常提醒'],
    },
    menu: {
      title: '目录菜单',
      subtitle: '把低频设置集中放在这里，像成熟 App 的最后一个菜单 Tab。',
      items: ['个人资料', '头像编辑', '语言与主题', '通知设置', '记忆墙设置', '设备管理', '管理工具', '退出登录'],
    },
    storeReady: '独立 APP 工程 · 目标发布到 Apple App Store / Google Play',
  },
  en: {
    appName: 'Family Hub',
    tagline: 'Send everyday family moments to the home memory wall.',
    tabs: {
      home: 'Home',
      upload: 'Upload',
      family: 'Family',
      notifications: 'Notifications',
      menu: 'Menu',
    },
    home: {
      title: 'Today in your family',
      subtitle: 'Check family status, recent memories, and home wall health.',
      primary: 'Upload memory',
      secondary: 'Invite family',
      cards: ['Wall connected', 'Latest 3 memories', 'Pending review'],
    },
    upload: {
      title: 'Send to family wall',
      subtitle: 'Pick photos or videos, add a title and note, then share with family.',
      steps: ['Pick photo / video', 'Preview and crop', 'Add title / note', 'Show upload progress'],
      primary: 'Choose media',
    },
    family: {
      title: 'Family and invites',
      subtitle: 'View members, share invite codes, generate QR codes, and manage displays.',
      actions: ['Copy invite code', 'Share invite link', 'Generate QR code', 'Display device entry'],
    },
    notifications: {
      title: 'Notification center',
      subtitle: 'See new memories, joins, review reminders, and display device alerts.',
      items: ['New memory alert', 'Family joined alert', 'Upload review alert', 'Display device alert'],
    },
    menu: {
      title: 'Menu directory',
      subtitle: 'Keep lower-frequency settings here, like the final tab in mature apps.',
      items: ['Profile', 'Avatar editor', 'Language and theme', 'Notification settings', 'Wall settings', 'Device management', 'Admin tools', 'Sign out'],
    },
    storeReady: 'Standalone APP project · Target Apple App Store / Google Play',
  },
} as const

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [locale, setLocale] = useState<Locale>('zh')
  const t = copy[locale]
  const active = useMemo(() => t[activeTab], [activeTab, t])

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t.storeReady}</Text>
            <Text style={styles.title}>{t.appName}</Text>
            <Text style={styles.tagline}>{t.tagline}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            style={styles.languageButton}
          >
            <Text style={styles.languageText}>{locale === 'zh' ? 'EN' : '中'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.screenTitle}>{active.title}</Text>
            <Text style={styles.screenSubtitle}>{active.subtitle}</Text>

            {'primary' in active ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{active.primary}</Text>
                </TouchableOpacity>
                {'secondary' in active ? (
                  <TouchableOpacity style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{active.secondary}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          {'cards' in active ? (
            <View style={styles.cardGrid}>
              {active.cards.map((card, index) => (
                <View key={card} style={styles.smallCard}>
                  <Text style={styles.cardNumber}>0{index + 1}</Text>
                  <Text style={styles.cardText}>{card}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {'steps' in active ? <BulletList items={active.steps} /> : null}
          {'actions' in active ? <BulletList items={active.actions} /> : null}
          {'items' in active ? <BulletList items={active.items} /> : null}
        </ScrollView>

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const selected = tab.key === activeTab
            return (
              <TouchableOpacity
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, selected && styles.tabItemActive]}
              >
                <Text style={[styles.tabIcon, selected && styles.tabIconActive]}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{t.tabs[tab.key]}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff7ed',
  },
  shell: {
    flex: 1,
    backgroundColor: '#fff7ed',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    color: '#9a3412',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: '#431407',
    fontSize: 30,
    fontWeight: '800',
  },
  tagline: {
    marginTop: 6,
    maxWidth: 290,
    color: '#7c2d12',
    fontSize: 14,
    lineHeight: 20,
  },
  languageButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#fed7aa',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  languageText: {
    color: '#7c2d12',
    fontWeight: '800',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  heroCard: {
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#431407',
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  screenTitle: {
    color: '#ffedd5',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
  },
  screenSubtitle: {
    marginTop: 10,
    color: '#fed7aa',
    fontSize: 15,
    lineHeight: 23,
  },
  actionsRow: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#431407',
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#ffedd5',
    fontWeight: '700',
  },
  cardGrid: {
    gap: 12,
  },
  smallCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  cardNumber: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
  },
  cardText: {
    marginTop: 6,
    color: '#431407',
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  dot: {
    color: '#f97316',
    fontSize: 18,
    lineHeight: 22,
  },
  listText: {
    flex: 1,
    color: '#431407',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 16,
    flexDirection: 'row',
    borderRadius: 30,
    padding: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    minHeight: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: '#ffedd5',
  },
  tabIcon: {
    color: '#9a3412',
    fontSize: 20,
    fontWeight: '900',
  },
  tabIconActive: {
    color: '#ea580c',
  },
  tabLabel: {
    color: '#9a3412',
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#7c2d12',
  },
})
