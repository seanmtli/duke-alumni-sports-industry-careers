import { getAlumni } from '@/lib/getAlumni';
import { DirectoryClient } from '@/components/directory/DirectoryClient';

export const metadata = {
  title: 'Directory | Duke Sports Alumni',
};

export default async function DirectoryPage() {
  return <DirectoryClient initialData={await getAlumni()} />;
}
