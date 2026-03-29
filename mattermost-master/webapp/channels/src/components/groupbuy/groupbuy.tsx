// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';

import type {AppStateType, Message, Procurement, User} from './types';

import './groupbuy.scss';

// --- Utilities ---

function formatTime(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
        return d.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
        return 'Вчера';
    }

    return d.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

function getInitials(firstName: string, lastName = ''): string {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last || '?';
}

function getAvatarColor(name: string): string {
    const colors = [
        '#e17076', '#faa774', '#a695e7', '#7bc862',
        '#6ec9cb', '#65aadd', '#ee7aae', '#f5a623',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getStatusText(status: string): string {
    const statuses: Record<string, string> = {
        draft: 'Черновик',
        active: 'Активная',
        stopped: 'Остановлена',
        payment: 'Оплата',
        completed: 'Завершена',
        cancelled: 'Отменена',
    };
    return statuses[status] || status;
}

function getRoleText(role: string): string {
    const roles: Record<string, string> = {
        buyer: 'Покупатель',
        organizer: 'Организатор',
        supplier: 'Поставщик',
    };
    return roles[role] || role;
}

// --- API Client ---

const CONFIG = {
    API_URL: '/api',
};

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('groupbuy_authToken');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers as Record<string, string> || {}),
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}

const API = {
    getUser: (userId: number) => apiRequest<User>(`/groupbuy/users/${userId}/`),
    getProcurements: (params: Record<string, string> = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest<{results?: Procurement[]} | Procurement[]>(`/groupbuy/procurements/?${query}`);
    },
    getProcurement: (id: number) => apiRequest<Procurement>(`/groupbuy/procurements/${id}/`),
    createProcurement: (data: Partial<Procurement>) => apiRequest<Procurement>('/groupbuy/procurements/', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    joinProcurement: (id: number, data: Record<string, unknown>) => apiRequest(`/groupbuy/procurements/${id}/join/`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    registerUser: (data: Partial<User> & {platform?: string}) => apiRequest<User>('/groupbuy/users/', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    getMessages: (procurementId: number, params: Record<string, string> = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest<{results?: Message[]} | Message[]>(`/groupbuy/chat/messages/?procurement=${procurementId}&${query}`);
    },
    sendMessage: (data: Partial<Message>) => apiRequest<Message>('/groupbuy/chat/messages/', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    deposit: (userId: number, amount: number) => apiRequest(`/groupbuy/payments/`, {
        method: 'POST',
        body: JSON.stringify({user: userId, amount, type: 'deposit'}),
    }),
};

// --- ProcurementSlider Component ---

interface ProcurementSliderProps {
    procurements: Procurement[];
    onCardClick: (id: number) => void;
}

const SCROLL_STEP = 220;

const ProcurementSlider: React.FC<ProcurementSliderProps> = ({procurements, onCardClick}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollButtons = useCallback(() => {
        const el = containerRef.current;
        if (!el) {
            return;
        }
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    useEffect(() => {
        updateScrollButtons();
        const el = containerRef.current;
        if (el) {
            el.addEventListener('scroll', updateScrollButtons);
            return () => el.removeEventListener('scroll', updateScrollButtons);
        }
        return undefined;
    }, [procurements, updateScrollButtons]);

    const scrollLeft = () => {
        containerRef.current?.scrollBy({left: -SCROLL_STEP, behavior: 'smooth'});
    };

    const scrollRight = () => {
        containerRef.current?.scrollBy({left: SCROLL_STEP, behavior: 'smooth'});
    };

    return (
        <section className='gb-procurement-slider'>
            <div className='gb-slider-header'>
                <h2 className='gb-slider-title'>{'Активные закупки'}</h2>
                <div className='gb-slider-nav'>
                    <button
                        className='gb-slider-nav-btn'
                        onClick={scrollLeft}
                        disabled={!canScrollLeft}
                        aria-label='Прокрутить влево'
                    >
                        <svg
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                        >
                            <polyline points='15 18 9 12 15 6'/>
                        </svg>
                    </button>
                    <button
                        className='gb-slider-nav-btn'
                        onClick={scrollRight}
                        disabled={!canScrollRight}
                        aria-label='Прокрутить вправо'
                    >
                        <svg
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                        >
                            <polyline points='9 18 15 12 9 6'/>
                        </svg>
                    </button>
                </div>
            </div>
            <div className='gb-slider-wrapper'>
                <div
                    className='gb-slider-container'
                    ref={containerRef}
                >
                    {procurements.length === 0 && (
                        <div style={{color: 'var(--tg-text-muted)', padding: '8px 0'}}>{'Загрузка закупок...'}</div>
                    )}
                    {procurements.map((p) => (
                        <div
                            key={p.id}
                            className='gb-procurement-card'
                            onClick={() => onCardClick(p.id)}
                        >
                            <div className='gb-procurement-title'>{p.title}</div>
                            <div className='gb-procurement-info'>{p.city}</div>
                            <div className='gb-procurement-progress'>
                                <div
                                    className='gb-procurement-progress-bar'
                                    style={{width: `${p.progress}%`}}
                                />
                            </div>
                            <div className='gb-procurement-stats'>
                                <span>{`${formatCurrency(p.current_amount)} / ${formatCurrency(p.target_amount)}`}</span>
                                <span>{`${p.days_left} дн.`}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// --- ChatList Component ---

interface ChatListProps {
    procurements: Procurement[];
    currentChat: number | null;
    unreadCounts: Record<number, number>;
    onChatClick: (id: number) => void;
}

const ChatList: React.FC<ChatListProps> = ({procurements, currentChat, unreadCounts, onChatClick}) => (
    <div className='gb-chat-list'>
        {procurements.length === 0 && (
            <div style={{padding: '16px', textAlign: 'center', color: 'var(--tg-text-muted)'}}>
                {'Загрузка...'}
            </div>
        )}
        {procurements.map((p) => (
            <div
                key={p.id}
                className={`gb-chat-item${currentChat === p.id ? ' active' : ''}`}
                onClick={() => onChatClick(p.id)}
            >
                <div
                    className='gb-chat-avatar'
                    style={{backgroundColor: getAvatarColor(p.title)}}
                >
                    {getInitials(p.title)}
                </div>
                <div className='gb-chat-info'>
                    <div className='gb-chat-header-row'>
                        <span className='gb-chat-title'>{p.title}</span>
                        <span className='gb-chat-time'>{formatTime(p.updated_at)}</span>
                    </div>
                    <div className='gb-chat-message'>
                        {`${p.participant_count} участников • ${p.progress}%`}
                    </div>
                </div>
                {unreadCounts[p.id] ? (
                    <div className='gb-chat-badge'>{unreadCounts[p.id]}</div>
                ) : null}
            </div>
        ))}
    </div>
);

// --- Cabinet Component ---

interface CabinetProps {
    user: User;
    onDeposit: () => void;
    onCreateProcurement: () => void;
}

const Cabinet: React.FC<CabinetProps> = ({user, onDeposit, onCreateProcurement}) => (
    <div className='gb-cabinet'>
        <div className='gb-cabinet-header'>
            <div
                className='gb-cabinet-avatar'
                style={{backgroundColor: getAvatarColor(user.first_name)}}
            >
                {getInitials(user.first_name, user.last_name)}
            </div>
            <div>
                <div className='gb-cabinet-name'>
                    {`${user.first_name} ${user.last_name || ''}`}
                </div>
                <div className='gb-cabinet-role'>{getRoleText(user.role)}</div>
            </div>
        </div>
        <div className='gb-cabinet-balance'>
            <div className='gb-balance-label'>{'Баланс'}</div>
            <div className='gb-balance-amount'>{formatCurrency(user.balance)}</div>
            <div className='gb-balance-actions'>
                <button
                    className='gb-btn gb-btn-primary'
                    onClick={onDeposit}
                >
                    {'Пополнить'}
                </button>
            </div>
        </div>
        <div className='gb-cabinet-menu'>
            <div className='gb-cabinet-menu-item'>
                <svg
                    className='gb-cabinet-menu-icon'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                >
                    <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/>
                </svg>
                <span className='gb-cabinet-menu-text'>{'Мои запросы'}</span>
            </div>
            <div className='gb-cabinet-menu-item'>
                <svg
                    className='gb-cabinet-menu-icon'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                >
                    <path d='M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z'/>
                    <line
                        x1='3'
                        y1='6'
                        x2='21'
                        y2='6'
                    />
                </svg>
                <span className='gb-cabinet-menu-text'>{'Мои закупки'}</span>
            </div>
            <div className='gb-cabinet-menu-item'>
                <svg
                    className='gb-cabinet-menu-icon'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                >
                    <circle
                        cx='12'
                        cy='12'
                        r='10'
                    />
                    <polyline points='12 6 12 12 16 14'/>
                </svg>
                <span className='gb-cabinet-menu-text'>{'История закупок'}</span>
            </div>
            {user.role === 'organizer' && (
                <div
                    className='gb-cabinet-menu-item'
                    onClick={onCreateProcurement}
                >
                    <svg
                        className='gb-cabinet-menu-icon'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                    >
                        <circle
                            cx='12'
                            cy='12'
                            r='10'
                        />
                        <line
                            x1='12'
                            y1='8'
                            x2='12'
                            y2='16'
                        />
                        <line
                            x1='8'
                            y1='12'
                            x2='16'
                            y2='12'
                        />
                    </svg>
                    <span className='gb-cabinet-menu-text'>{'Создать закупку'}</span>
                </div>
            )}
        </div>
    </div>
);

// --- MessageArea Component ---

interface MessageAreaProps {
    messages: Message[];
    currentUser: User | null;
}

function formatMessageDate(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 86400000) {
        return 'Сегодня';
    }
    if (diff < 172800000) {
        return 'Вчера';
    }

    return d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
}

const MessageArea: React.FC<MessageAreaProps> = ({messages, currentUser}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages]);

    let lastDate: string | null = null;

    return (
        <div
            className='gb-message-area'
            ref={containerRef}
        >
            {messages.map((msg) => {
                const msgDate = new Date(msg.created_at).toDateString();
                const showDivider = msgDate !== lastDate;
                lastDate = msgDate;

                const isOwn = currentUser && msg.user && msg.user.id === currentUser.id;

                return (
                    <React.Fragment key={msg.id}>
                        {showDivider && (
                            <div className='gb-message-date-divider'>
                                <span>{formatMessageDate(msg.created_at)}</span>
                            </div>
                        )}
                        {msg.message_type === 'system' ? (
                            <div className='gb-message system'>{msg.text}</div>
                        ) : (
                            <div className={`gb-message ${isOwn ? 'outgoing' : 'incoming'}`}>
                                {!isOwn && msg.user && (
                                    <div className='gb-message-sender'>{msg.user.first_name}</div>
                                )}
                                <div className='gb-message-text'>{msg.text}</div>
                                <div className='gb-message-time'>{formatTime(msg.created_at)}</div>
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// --- Toast Component ---

interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

// --- Main GroupBuy Component ---

const GroupBuy: React.FC = () => {
    const [appState, setAppState] = useState<AppStateType>({
        user: null,
        currentChat: null,
        procurements: [],
        messages: [],
        isLoading: false,
        unreadCounts: {},
    });
    const [activeTab, setActiveTab] = useState<'chats' | 'cabinet'>('chats');
    const [searchQuery, setSearchQuery] = useState('');
    const [messageText, setMessageText] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [toastCounter, setToastCounter] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Modal states
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showProcurementModal, setShowProcurementModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [selectedProcurement, setSelectedProcurement] = useState<Procurement | null>(null);

    // Register form state
    const [registerForm, setRegisterForm] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        role: 'buyer',
    });

    // Create procurement form state
    const [createForm, setCreateForm] = useState({
        title: '',
        description: '',
        city: '',
        target_amount: '',
        unit: '',
        deadline: '',
    });

    const [depositAmount, setDepositAmount] = useState('');

    const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = toastCounter + 1;
        setToastCounter(id);
        setToasts((prev) => [...prev, {id, message, type}]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, [toastCounter]);

    const loadMainContent = useCallback(async (user: User) => {
        try {
            const response = await API.getProcurements({status: 'active'});
            const procurements = Array.isArray(response) ? response : (response.results || []);
            setAppState((prev) => ({...prev, procurements, user}));
        } catch {
            console.error('Error loading procurements');
        }
    }, []);

    useEffect(() => {
        const userId = localStorage.getItem('groupbuy_userId');
        if (userId) {
            API.getUser(parseInt(userId)).
                then((user) => loadMainContent(user)).
                catch(() => setShowLoginModal(true));
        } else {
            setShowLoginModal(true);
        }
    }, [loadMainContent]);

    const handleRegister = async () => {
        try {
            const user = await API.registerUser({
                ...registerForm,
                platform: 'websocket',
                balance: 0,
            });
            localStorage.setItem('groupbuy_userId', String(user.id));
            setShowLoginModal(false);
            await loadMainContent(user);
            showToast('Регистрация успешна', 'success');
        } catch {
            showToast('Ошибка регистрации', 'error');
        }
    };

    const handleOpenChat = useCallback(async (procurementId: number) => {
        setAppState((prev) => ({
            ...prev,
            currentChat: procurementId,
            unreadCounts: {...prev.unreadCounts, [procurementId]: 0},
        }));
        setSidebarOpen(false);

        try {
            const response = await API.getMessages(procurementId);
            const messages = Array.isArray(response) ? response : (response.results || []);
            setAppState((prev) => ({...prev, messages}));
        } catch {
            showToast('Ошибка загрузки сообщений', 'error');
        }
    }, [showToast]);

    const handleOpenProcurementDetails = useCallback(async (id: number) => {
        try {
            const procurement = await API.getProcurement(id);
            setSelectedProcurement(procurement);
            setShowProcurementModal(true);
        } catch {
            showToast('Ошибка загрузки закупки', 'error');
        }
    }, [showToast]);

    const handleSendMessage = async () => {
        const text = messageText.trim();
        if (!text || !appState.currentChat || !appState.user) {
            return;
        }

        try {
            const message = await API.sendMessage({
                procurement: appState.currentChat,
                user: appState.user,
                text,
                message_type: 'text',
                created_at: new Date().toISOString(),
            });
            setAppState((prev) => ({...prev, messages: [...prev.messages, message]}));
            setMessageText('');
        } catch {
            showToast('Ошибка отправки сообщения', 'error');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleJoinProcurement = async () => {
        if (!selectedProcurement || !appState.user) {
            return;
        }
        try {
            await API.joinProcurement(selectedProcurement.id, {user: appState.user.id});
            setShowProcurementModal(false);
            showToast('Вы присоединились к закупке', 'success');
            await handleOpenChat(selectedProcurement.id);
        } catch {
            showToast('Ошибка при вступлении в закупку', 'error');
        }
    };

    const handleCreateProcurement = async () => {
        try {
            await API.createProcurement({
                ...createForm,
                target_amount: parseFloat(createForm.target_amount),
            });
            setShowCreateModal(false);
            showToast('Закупка создана', 'success');
            if (appState.user) {
                await loadMainContent(appState.user);
            }
        } catch {
            showToast('Ошибка создания закупки', 'error');
        }
    };

    const handleDeposit = async () => {
        if (!appState.user) {
            return;
        }
        try {
            await API.deposit(appState.user.id, parseFloat(depositAmount));
            setShowDepositModal(false);
            setDepositAmount('');
            showToast('Баланс пополнен', 'success');
        } catch {
            showToast('Ошибка пополнения баланса', 'error');
        }
    };

    const filteredProcurements = searchQuery.trim() ?
        appState.procurements.filter(
            (p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.city.toLowerCase().includes(searchQuery.toLowerCase()),
        ) : appState.procurements;

    const currentChatProcurement = appState.currentChat ?
        appState.procurements.find((p) => p.id === appState.currentChat) : null;

    return (
        <div className='groupbuy-app'>
            {/* Sidebar */}
            <aside className={`gb-sidebar${sidebarOpen ? ' open' : ''}`}>
                <header className='gb-header'>
                    <button
                        className='gb-btn gb-btn-icon'
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        aria-label='Меню'
                    >
                        <svg
                            width='24'
                            height='24'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                        >
                            <line
                                x1='3'
                                y1='12'
                                x2='21'
                                y2='12'
                            />
                            <line
                                x1='3'
                                y1='6'
                                x2='21'
                                y2='6'
                            />
                            <line
                                x1='3'
                                y1='18'
                                x2='21'
                                y2='18'
                            />
                        </svg>
                    </button>
                    <h1 className='gb-header-title'>{'GroupBuy'}</h1>
                </header>

                <div className='gb-search-bar'>
                    <svg
                        className='gb-search-icon'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                    >
                        <circle
                            cx='11'
                            cy='11'
                            r='8'
                        />
                        <line
                            x1='21'
                            y1='21'
                            x2='16.65'
                            y2='16.65'
                        />
                    </svg>
                    <input
                        type='text'
                        className='gb-search-input'
                        placeholder='Поиск...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className='gb-tabs'>
                    <button
                        className={`gb-tab${activeTab === 'chats' ? ' active' : ''}`}
                        onClick={() => setActiveTab('chats')}
                    >
                        {'Чаты'}
                    </button>
                    <button
                        className={`gb-tab${activeTab === 'cabinet' ? ' active' : ''}`}
                        onClick={() => setActiveTab('cabinet')}
                    >
                        {'Кабинет'}
                    </button>
                </div>

                {activeTab === 'chats' && (
                    <ChatList
                        procurements={filteredProcurements}
                        currentChat={appState.currentChat}
                        unreadCounts={appState.unreadCounts}
                        onChatClick={handleOpenChat}
                    />
                )}

                {activeTab === 'cabinet' && appState.user && (
                    <Cabinet
                        user={appState.user}
                        onDeposit={() => setShowDepositModal(true)}
                        onCreateProcurement={() => setShowCreateModal(true)}
                    />
                )}
            </aside>

            {/* Main content */}
            <main className='gb-main-content'>
                <ProcurementSlider
                    procurements={appState.procurements}
                    onCardClick={handleOpenProcurementDetails}
                />

                {appState.currentChat ? (
                    <>
                        <header className='gb-header'>
                            <button
                                className='gb-btn gb-btn-icon'
                                onClick={() => setAppState((prev) => ({...prev, currentChat: null, messages: []}))}
                                aria-label='Назад'
                            >
                                <svg
                                    width='24'
                                    height='24'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                >
                                    <polyline points='15 18 9 12 15 6'/>
                                </svg>
                            </button>
                            {currentChatProcurement && (
                                <div
                                    className='gb-chat-avatar'
                                    style={{
                                        backgroundColor: getAvatarColor(currentChatProcurement.title),
                                        width: '36px',
                                        height: '36px',
                                        fontSize: '14px',
                                    }}
                                >
                                    {getInitials(currentChatProcurement.title)}
                                </div>
                            )}
                            <div>
                                <div className='gb-header-title'>
                                    {currentChatProcurement?.title || 'Чат'}
                                </div>
                                {currentChatProcurement && (
                                    <div className='gb-header-subtitle'>
                                        {`${currentChatProcurement.participant_count} участников`}
                                    </div>
                                )}
                            </div>
                            {currentChatProcurement && (
                                <button
                                    className='gb-btn gb-btn-icon'
                                    onClick={() => handleOpenProcurementDetails(appState.currentChat!)}
                                    aria-label='Подробнее'
                                    style={{marginLeft: 'auto'}}
                                >
                                    <svg
                                        width='20'
                                        height='20'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2'
                                    >
                                        <circle
                                            cx='12'
                                            cy='12'
                                            r='1'
                                        />
                                        <circle
                                            cx='12'
                                            cy='5'
                                            r='1'
                                        />
                                        <circle
                                            cx='12'
                                            cy='19'
                                            r='1'
                                        />
                                    </svg>
                                </button>
                            )}
                        </header>

                        <MessageArea
                            messages={appState.messages}
                            currentUser={appState.user}
                        />

                        <div className='gb-message-input-area'>
                            <button
                                className='gb-btn gb-btn-icon'
                                aria-label='Прикрепить файл'
                            >
                                <svg
                                    width='24'
                                    height='24'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                >
                                    <path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'/>
                                </svg>
                            </button>
                            <div className='gb-message-input-container'>
                                <textarea
                                    className='gb-message-input'
                                    placeholder='Сообщение...'
                                    rows={1}
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>
                            <button
                                className='gb-send-button'
                                onClick={handleSendMessage}
                                aria-label='Отправить'
                            >
                                <svg
                                    width='24'
                                    height='24'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                >
                                    <line
                                        x1='22'
                                        y1='2'
                                        x2='11'
                                        y2='13'
                                    />
                                    <polygon points='22 2 15 22 11 13 2 9 22 2'/>
                                </svg>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className='gb-welcome-screen'>
                        <svg
                            width='120'
                            height='120'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='1.5'
                        >
                            <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/>
                        </svg>
                        <h2>{'Добро пожаловать в GroupBuy'}</h2>
                        <p>{'Выберите закупку или создайте новую'}</p>
                    </div>
                )}
            </main>

            {/* Login Modal */}
            {showLoginModal && (
                <div className='gb-modal-overlay active'>
                    <div className='gb-modal'>
                        <div className='gb-modal-header'>
                            <h3 className='gb-modal-title'>{'Регистрация'}</h3>
                        </div>
                        <div className='gb-modal-body'>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Имя *'}</label>
                                <input
                                    type='text'
                                    className='gb-form-input'
                                    placeholder='Введите имя'
                                    value={registerForm.first_name}
                                    onChange={(e) => setRegisterForm((f) => ({...f, first_name: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Фамилия'}</label>
                                <input
                                    type='text'
                                    className='gb-form-input'
                                    placeholder='Введите фамилию'
                                    value={registerForm.last_name}
                                    onChange={(e) => setRegisterForm((f) => ({...f, last_name: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Телефон'}</label>
                                <input
                                    type='tel'
                                    className='gb-form-input'
                                    placeholder='+7 999 123 4567'
                                    value={registerForm.phone}
                                    onChange={(e) => setRegisterForm((f) => ({...f, phone: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Email'}</label>
                                <input
                                    type='email'
                                    className='gb-form-input'
                                    placeholder='email@example.com'
                                    value={registerForm.email}
                                    onChange={(e) => setRegisterForm((f) => ({...f, email: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Роль *'}</label>
                                <select
                                    className='gb-form-input'
                                    value={registerForm.role}
                                    onChange={(e) => setRegisterForm((f) => ({...f, role: e.target.value}))}
                                    style={{height: '44px', cursor: 'pointer'}}
                                >
                                    <option value='buyer'>{'Покупатель'}</option>
                                    <option value='organizer'>{'Организатор'}</option>
                                    <option value='supplier'>{'Поставщик'}</option>
                                </select>
                            </div>
                        </div>
                        <div className='gb-modal-footer'>
                            <button
                                className='gb-btn gb-btn-primary'
                                onClick={handleRegister}
                                disabled={!registerForm.first_name}
                            >
                                {'Зарегистрироваться'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Procurement Details Modal */}
            {showProcurementModal && selectedProcurement && (
                <div
                    className='gb-modal-overlay active'
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowProcurementModal(false);
                        }
                    }}
                >
                    <div className='gb-modal'>
                        <div className='gb-modal-header'>
                            <h3 className='gb-modal-title'>{selectedProcurement.title}</h3>
                            <button
                                className='gb-btn gb-btn-icon'
                                onClick={() => setShowProcurementModal(false)}
                            >
                                <svg
                                    width='24'
                                    height='24'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                >
                                    <line
                                        x1='18'
                                        y1='6'
                                        x2='6'
                                        y2='18'
                                    />
                                    <line
                                        x1='6'
                                        y1='6'
                                        x2='18'
                                        y2='18'
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className='gb-modal-body'>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Описание'}</label>
                                <p style={{color: 'var(--tg-text-primary)', lineHeight: '1.5'}}>{selectedProcurement.description}</p>
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Город'}</label>
                                <p style={{color: 'var(--tg-text-primary)'}}>{selectedProcurement.city}</p>
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Прогресс'}</label>
                                <div className='gb-procurement-progress' style={{marginTop: '8px'}}>
                                    <div
                                        className='gb-procurement-progress-bar'
                                        style={{width: `${selectedProcurement.progress}%`}}
                                    />
                                </div>
                                <p style={{marginTop: '8px', color: 'var(--tg-text-secondary)'}}>
                                    {`${formatCurrency(selectedProcurement.current_amount)} из ${formatCurrency(selectedProcurement.target_amount)}`}
                                </p>
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Участники'}</label>
                                <p style={{color: 'var(--tg-text-primary)'}}>{`${selectedProcurement.participant_count} человек`}</p>
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Статус'}</label>
                                <span className={`gb-status-badge status-${selectedProcurement.status}`}>
                                    {getStatusText(selectedProcurement.status)}
                                </span>
                            </div>
                        </div>
                        <div className='gb-modal-footer'>
                            <button
                                className='gb-btn gb-btn-secondary'
                                onClick={() => setShowProcurementModal(false)}
                            >
                                {'Закрыть'}
                            </button>
                            <button
                                className='gb-btn gb-btn-primary'
                                onClick={handleJoinProcurement}
                            >
                                {'Участвовать'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Procurement Modal */}
            {showCreateModal && (
                <div
                    className='gb-modal-overlay active'
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowCreateModal(false);
                        }
                    }}
                >
                    <div className='gb-modal'>
                        <div className='gb-modal-header'>
                            <h3 className='gb-modal-title'>{'Создать закупку'}</h3>
                            <button
                                className='gb-btn gb-btn-icon'
                                onClick={() => setShowCreateModal(false)}
                            >
                                <svg
                                    width='24'
                                    height='24'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                >
                                    <line
                                        x1='18'
                                        y1='6'
                                        x2='6'
                                        y2='18'
                                    />
                                    <line
                                        x1='6'
                                        y1='6'
                                        x2='18'
                                        y2='18'
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className='gb-modal-body'>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Название товара *'}</label>
                                <input
                                    type='text'
                                    className='gb-form-input'
                                    placeholder='Например: Мед натуральный'
                                    value={createForm.title}
                                    onChange={(e) => setCreateForm((f) => ({...f, title: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Описание *'}</label>
                                <textarea
                                    className='gb-form-input'
                                    placeholder='Подробное описание закупки...'
                                    style={{height: '80px', paddingTop: '10px', resize: 'vertical'}}
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm((f) => ({...f, description: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Город получения *'}</label>
                                <input
                                    type='text'
                                    className='gb-form-input'
                                    placeholder='Москва'
                                    value={createForm.city}
                                    onChange={(e) => setCreateForm((f) => ({...f, city: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Целевая сумма (руб.) *'}</label>
                                <input
                                    type='number'
                                    className='gb-form-input'
                                    placeholder='10000'
                                    min='1000'
                                    value={createForm.target_amount}
                                    onChange={(e) => setCreateForm((f) => ({...f, target_amount: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Единица измерения'}</label>
                                <input
                                    type='text'
                                    className='gb-form-input'
                                    placeholder='кг, шт, л'
                                    value={createForm.unit}
                                    onChange={(e) => setCreateForm((f) => ({...f, unit: e.target.value}))}
                                />
                            </div>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Дедлайн *'}</label>
                                <input
                                    type='datetime-local'
                                    className='gb-form-input'
                                    value={createForm.deadline}
                                    onChange={(e) => setCreateForm((f) => ({...f, deadline: e.target.value}))}
                                />
                            </div>
                        </div>
                        <div className='gb-modal-footer'>
                            <button
                                className='gb-btn gb-btn-secondary'
                                onClick={() => setShowCreateModal(false)}
                            >
                                {'Отмена'}
                            </button>
                            <button
                                className='gb-btn gb-btn-primary'
                                onClick={handleCreateProcurement}
                                disabled={!createForm.title || !createForm.description || !createForm.city || !createForm.target_amount || !createForm.deadline}
                            >
                                {'Создать'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deposit Modal */}
            {showDepositModal && (
                <div
                    className='gb-modal-overlay active'
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowDepositModal(false);
                        }
                    }}
                >
                    <div className='gb-modal'>
                        <div className='gb-modal-header'>
                            <h3 className='gb-modal-title'>{'Пополнение баланса'}</h3>
                            <button
                                className='gb-btn gb-btn-icon'
                                onClick={() => setShowDepositModal(false)}
                            >
                                <svg
                                    width='24'
                                    height='24'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                >
                                    <line
                                        x1='18'
                                        y1='6'
                                        x2='6'
                                        y2='18'
                                    />
                                    <line
                                        x1='6'
                                        y1='6'
                                        x2='18'
                                        y2='18'
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className='gb-modal-body'>
                            <div className='gb-form-group'>
                                <label className='gb-form-label'>{'Сумма (руб.) *'}</label>
                                <input
                                    type='number'
                                    className='gb-form-input'
                                    placeholder='1000'
                                    min='100'
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                />
                            </div>
                            <p style={{color: 'var(--tg-text-secondary)', fontSize: '12px', marginTop: '8px'}}>
                                {'Минимальная сумма пополнения: 100 руб.'}
                            </p>
                        </div>
                        <div className='gb-modal-footer'>
                            <button
                                className='gb-btn gb-btn-secondary'
                                onClick={() => setShowDepositModal(false)}
                            >
                                {'Отмена'}
                            </button>
                            <button
                                className='gb-btn gb-btn-primary'
                                onClick={handleDeposit}
                                disabled={!depositAmount || parseFloat(depositAmount) < 100}
                            >
                                {'Пополнить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast container */}
            <div className='gb-toast-container'>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`gb-toast ${toast.type}`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupBuy;
