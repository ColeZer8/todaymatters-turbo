import { useEffect, useState } from 'react';
import { CommunicationTemplate, type Communication } from '../components/templates/CommunicationTemplate';
import { useAuthStore } from '@/stores';
import { fetchGmailEmailEvents } from '@/lib/supabase/services';
import {
    formatCommunicationTime,
    formatCommunicationTimestamp,
    getDisplayNameFromFromAddress,
    getGmailFromAddress,
    getGmailSubject,
    getInitialsFromName,
} from '@/lib/communication/communication-utils';

export default function CommunicationScreen() {
    const userId = useAuthStore((s) => s.user?.id ?? null);

    const [communications, setCommunications] = useState<Communication[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;

        let cancelled = false;
        setIsLoading(true);
        setErrorMessage(null);

        (async () => {
            try {
                const rows = await fetchGmailEmailEvents(userId, {
                    limit: 75,
                    includeRead: true,
                    includeArchived: false,
                    sinceHours: 24,
                });
                if (cancelled) return;

                const mapped: Communication[] = rows.map((row) => {
                    const subject =
                        row.title?.trim() || getGmailSubject(row.meta) || '(No subject)';
                    const fromAddress = getGmailFromAddress(row.meta);
                    const senderName = getDisplayNameFromFromAddress(fromAddress);
                    const message = subject;
                    const time = formatCommunicationTime(row.created_at);
                    const receivedAt = formatCommunicationTimestamp(row.created_at);

                    return {
                        id: row.id,
                        name: senderName,
                        message,
                        time,
                        receivedAt,
                        unread: isGmailUnreadFromMeta(row.meta),
                        initials: getInitialsFromName(senderName),
                        source: 'gmail',
                    };
                });

                setCommunications(mapped);
            } catch (e: unknown) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : 'Unknown error';
                setErrorMessage(msg);
            } finally {
                if (cancelled) return;
                setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const handleMarkRead = (id: string) => {
        setCommunications((prev) => prev.filter((item) => item.id !== id));
    };

    const handleMarkAllRead = () => {
        setCommunications((prev) => prev.filter((item) => !item.unread));
    };

    return (
        <CommunicationTemplate
            communications={communications}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
        />
    );
}

function isGmailUnreadFromMeta(meta: unknown): boolean {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
    const raw = (meta as Record<string, unknown>).raw;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const labelIds = (raw as Record<string, unknown>).labelIds;
    if (!Array.isArray(labelIds)) return false;
    return labelIds.some((v) => typeof v === 'string' && v.toUpperCase() === 'UNREAD');
}
