import { redirect } from 'next/navigation';

interface CallingListPageProps {
  params: {
    listId: string;
  };
}

const CallingListPage = ({ params }: CallingListPageProps) => {
  const encodedListId = encodeURIComponent(params.listId);
  redirect(`/calling?listId=${encodedListId}`);
};

export default CallingListPage;
