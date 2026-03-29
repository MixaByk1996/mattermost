// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ProcurementStatus = 'draft' | 'active' | 'stopped' | 'payment' | 'completed' | 'cancelled';

export type UserRole = 'buyer' | 'organizer' | 'supplier';

export interface Procurement {
    id: number;
    title: string;
    description: string;
    city: string;
    category?: string;
    target_amount: number;
    current_amount: number;
    unit?: string;
    deadline: string;
    status: ProcurementStatus;
    progress: number;
    participant_count: number;
    days_left: number;
    updated_at: string;
}

export interface User {
    id: number;
    first_name: string;
    last_name?: string;
    phone?: string;
    email?: string;
    role: UserRole;
    balance: number;
    platform?: string;
}

export interface Message {
    id: number;
    procurement: number;
    user?: User;
    text: string;
    message_type: 'text' | 'system';
    created_at: string;
}

export interface AppStateType {
    user: User | null;
    currentChat: number | null;
    procurements: Procurement[];
    messages: Message[];
    isLoading: boolean;
    unreadCounts: Record<number, number>;
}
