import { createInviteCode, getInviteCodes } from "../../../actions/invite-actions";

export default async function AdminCodesPage() {
  const codes = await getInviteCodes();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Member Invite Codes</h1>
        
        {/* Form to trigger the Server Action */}
        <form action={createInviteCode}>
          <button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            + Generate New Code
          </button>
        </form>
      </div>

      <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
            <tr>
              <th className="px-6 py-4 font-semibold">Code</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Used By</th>
              <th className="px-6 py-4 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {codes.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 text-gray-700">
                <td className="px-6 py-4 font-mono font-bold text-blue-600">{item.code}</td>
                <td className="px-6 py-4">
                  {item.isUsed ? (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-full">Used</span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded-full">Available</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {item.usedBy?.name || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}