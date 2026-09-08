export interface PublicPlatformContactConfig {
  enterpriseWhatsAppNumber?: unknown
  enterpriseWhatsAppEnabled?: unknown
  enterpriseWhatsAppMessage?: unknown
}

export interface EnterpriseContact {
  enabled: boolean
  href: string
  label: 'اطلب عرضًا مخصصًا' | 'تواصل معنا'
  message: string
}

export function resolveEnterpriseContact(config?: PublicPlatformContactConfig | null): EnterpriseContact {
  const number = String(config?.enterpriseWhatsAppNumber || '').replace(/\D/g, '')
  const message = typeof config?.enterpriseWhatsAppMessage === 'string'
    ? config.enterpriseWhatsAppMessage.trim()
    : ''
  const enabled = config?.enterpriseWhatsAppEnabled === true && number.length >= 8 && number.length <= 15

  if (!enabled) return { enabled: false, href: '#contact', label: 'تواصل معنا', message: '' }

  return {
    enabled: true,
    href: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
    label: 'اطلب عرضًا مخصصًا',
    message,
  }
}
