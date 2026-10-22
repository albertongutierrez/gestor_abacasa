import { Link, usePage } from '@inertiajs/react';
import { ComponentProps, useSyncExternalStore } from 'react';
import { returnDestination, subscribeNavigation } from '@/lib/contextualNavigation';

export default function BackLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
    const { url } = usePage();
    const destination = useSyncExternalStore(subscribeNavigation, () => returnDestination(url, href), () => href);
    return <Link {...props} href={destination} replace preserveState={false} preserveScroll={false} />;
}
