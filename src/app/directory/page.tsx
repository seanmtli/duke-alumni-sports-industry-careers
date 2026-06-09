import { getAlumni } from '@/lib/getAlumni';
import { DirectoryClient } from '@/components/directory/DirectoryClient';

export const metadata = {
  title: 'Directory | Duke Sports Alumni',
};

export default function DirectoryPage() {
  return <DirectoryClient initialData={getAlumni()} />;
}
