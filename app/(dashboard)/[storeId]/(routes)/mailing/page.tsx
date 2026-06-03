import { MailingClient } from "./components/client";

const MailingPage = async ({}: {}) => {
  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <MailingClient />
      </div>
    </div>
  );
};

export default MailingPage;
