using Microsoft.Azure.KeyVault;
using Microsoft.Azure.Services.AppAuthentication;
using System;
using System.Linq;

namespace ConnectionStringProvider
{
    /// <summary>
    /// Gets connection string with optional query to Azure Keyvault
    /// </summary>
    public static class ConnectionString
    {
        /// <summary>
        /// Gets connection string with optional query to Azure KeyVault
        /// </summary>
        /// <param name="connectionString">AKV secret if parameter starts with VaultUrl (case insensitive) or value of connectionString</param>
        /// <example>
        /// "VaultUrl=https://my_vault.vault.azure.net/; Key=MyConnectionStringSecret" is retrieved from AKV.
        /// "Url=https://org.crm.dynamics.com; AuthType=ClientSecret; ClientId=xxxxxx-yyyyy-zzzzzz; ClientSecret=XYZ123" is returned as is.
        /// </example>
        /// <returns>Actual connection string</returns>
        public static string Get(string connectionString)
        {
            if (string.IsNullOrEmpty(connectionString))
            {
                throw new ArgumentNullException(nameof(connectionString));
            }

            if (!UseAzureKeyVault(connectionString))
            {
                return connectionString;
            }

            try
            {

                (string vaultUrl, string secret) = ParseKeyVaultConfig(connectionString);

                var tokenCallback = new AzureServiceTokenProvider("RunAs=Developer; DeveloperTool=AzureCli").KeyVaultTokenCallback;
                var authCallback = new KeyVaultClient.AuthenticationCallback(tokenCallback);
                var client = new KeyVaultClient(authCallback);

                var retrievedSecret = client.GetSecretAsync(vaultUrl, secret).Result;

                return retrievedSecret?.Value;
            }
            catch (AzureServiceTokenProviderException)
            {
                throw new Exception("Unable to log into Azure KeyVault.\r\n" +
                                    "Run \"az login\" to obtain a token.\r\n" +
                                    "Requires Azure CLI - https://aka.ms/installazurecliwindows"
                );
            }
        }

        private static bool UseAzureKeyVault(string connectionString)
        {
            return connectionString.ToUpperInvariant().Contains("VAULTURL");
        }

        private static (string vaultUrl, string secret) ParseKeyVaultConfig(string connectionString)
        {
            string[] parts = connectionString.Split(';').Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToArray();

            string vaultUrl = parts.Where(x => x.StartsWith("VaultUrl")).FirstOrDefault()?.Replace("VaultUrl", "")?.Replace("=", "")?.Trim();
            string secret = parts.Where(x => x.StartsWith("Key")).FirstOrDefault()?.Replace("Key", "")?.Replace("=", "")?.Trim();

            return (vaultUrl, secret);
        }
    }
}
