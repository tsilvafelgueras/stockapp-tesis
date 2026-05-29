export type Role = 'operario' | 'ventas' | 'admin' | 'super'

export function homePathForRole(role: Role | string | null | undefined): string {
  switch (role) {
    case 'operario':
      return '/operario/dashboard'
    case 'ventas':
      return '/ventas/dashboard'
    case 'admin':
      return '/admin/dashboard'
    case 'super':
      return '/super'
    default:
      return '/login'
  }
}
