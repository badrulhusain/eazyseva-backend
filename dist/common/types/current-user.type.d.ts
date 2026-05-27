export type UserRole = 'USER' | 'ADMIN';
export interface CurrentUser {
    id: string;
    email: string;
    role: UserRole;
    full_name: string | null;
    phone: string | null;
}
