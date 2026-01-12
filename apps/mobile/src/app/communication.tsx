import { useEffect, useState } from 'react';
import { CommunicationTemplate, type Communication } from '../components/templates/CommunicationTemplate';
import { useAuthStore } from '@/stores';
import { fetchGmailEmailEvents } from '@/lib/supabase/services';
import {
    formatCommunicationTime,
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
                const rows = await fetchGmailEmailEvents(userId, { limit: 75, includeRead: true });
                if (cancelled) return;

                const mapped: Communication[] = rows.map((row) => {
                    const subject = row.title?.trim() || '(No subject)';
                    const message = subject;
                    const time = formatCommunicationTime(row.created_at);

                    return {
                        id: row.id,
                        name: 'Gmail',
                        message,
                        time,
                        unread: isGmailUnreadFromMeta(row.meta),
                        initials: getInitialsFromName('Gmail'),
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

    return <CommunicationTemplate communications={communications} isLoading={isLoading} errorMessage={errorMessage} />;
}

function isGmailUnreadFromMeta(meta: unknown): boolean {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
    const raw = (meta as Record<string, unknown>).raw;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const labelIds = (raw as Record<string, unknown>).labelIds;
    if (!Array.isArray(labelIds)) return false;
    return labelIds.some((v) => typeof v === 'string' && v.toUpperCase() === 'UNREAD');
}
