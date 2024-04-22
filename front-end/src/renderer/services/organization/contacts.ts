import axios from 'axios';

export async function getBackendOrganizationContacts(organizationServerUrl: string) {
  try {
    const response = await axios.get(`${organizationServerUrl}/users`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to get organization users');
  }
}

export async function getBackendContactPublicKeys(organizationServerUrl: string, id: string) {
  try {
    const response = await axios.get(`${organizationServerUrl}/user/${id}/keys`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to get organization user keys');
  }
}

export async function addOrganizationContact(organizationServerUrl: string, email: string) {
  try {
    const response = await axios.post(
      `${organizationServerUrl}/users`,
      {
        email,
      },
      {
        withCredentials: true,
      },
    );
    console.log(response.data);
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to add user');
  }
}

// export async function createKey(organizationServerUrl: string, publicKey: string) {
//   try {
//     const response = await axios.post(
//       `${organizationServerUrl}/user/keys`,
//       {
//         publicKey,
//       },
//       {
//         withCredentials: false,
//       },
//     );
//     console.log(response.data);
//     return response.data;
//   } catch (error: any) {
//     console.log(error);
//     throw new Error('Failed to add user');
//   }
// }

// export async function createUser(organizationServerUrl: string, email: string) {
//   try {
//     const response = await axios.post(
//       `${organizationServerUrl}/auth/signup`,
//       {
//         email,
//       },
//       {
//         withCredentials: false,
//       },
//     );
//     console.log(response.data);
//     return response.data;
//   } catch (error: any) {
//     console.log(error);
//     throw new Error('Failed to add user');
//   }
// }

// export async function deleteUser() {
//   try {
//     const response = await axios.delete(`http://localhost:3000/users/2`, {
//       withCredentials: true,
//     });
//     console.log(response.data);
//     return response.data;
//   } catch (error: any) {
//     console.log(error);
//     throw new Error('Failed to add user');
//   }
// }
