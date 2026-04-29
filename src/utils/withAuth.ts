import { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { getSession } from 'next-auth/react';

export function withAuth(gssp?: GetServerSideProps): GetServerSideProps {
  return async (context: GetServerSidePropsContext) => {
    const session = await getSession(context);

    if (!session) {
      return {
        redirect: {
          destination: '/auth/login',
          permanent: false,
        },
      };
    }

    if (!gssp) {
      return {
        props: {
          session,
        },
      };
    }

    const gsspData = await gssp(context);

    if ('props' in gsspData) {
      return {
        ...gsspData,
        props: {
          ...gsspData.props,
          session,
        },
      };
    }

    return gsspData;
  };
}