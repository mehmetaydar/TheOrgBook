import logging

from api_v2.models.CredentialType import CredentialType
from api_v2.models.Issuer import Issuer
from api_v2.models.Schema import Schema

from api.auth import create_issuer_user, verify_signature, VerifierException

from api_v2.serializers.rest import (
    IssuerSerializer,
    SchemaSerializer,
    CredentialTypeSerializer,
)

logger = logging.getLogger(__name__)


class IssuerException(Exception):
    pass


class IssuerManager:
    """
    Handle registration of issuer services, taking the JSON definition
    of the issuer and updating the related tables.
    """

    def register_issuer(self, request, spec):
        # TODO: move sig verification into middleware – decorator?
        # TODO: accept required params instead of spec (schema
        # validated in view)
        try:
            verified = verify_signature(request)
        except VerifierException as e:
            raise IssuerException("Signature validation error: {}".format(e))
        if not verified:
            raise IssuerException("Missing HTTP Signature")
        logger.debug("DID signature verified: %s", verified)

        user = self.update_user(verified, spec["issuer"])
        issuer = self.update_issuer(spec["issuer"])
        schemas, credential_types = self.update_schemas_and_ctypes(
            issuer, spec.get("credential_types", [])
        )

        # TODO: use a serializer to return consistent data with REST API?
        #       Do this at the view layer instead of this manager?
        result = {
            "issuer": IssuerSerializer(issuer).data,
            "schemas": [SchemaSerializer(schema).data for schema in schemas],
            "credential_types": [
                CredentialTypeSerializer(credential_type).data
                for credential_type in credential_types
            ],
        }
        return result

    def update_user(self, verified, issuer_def):
        """
        Update Django user with incoming issuer data.
        """
        issuer_did = issuer_def["did"]
        display_name = issuer_def["name"]
        user_email = issuer_def["email"]
        verified_did = verified["keyId"]
        verkey = verified["key"]
        assert "did:sov:{}".format(issuer_did) == verified_did
        return create_issuer_user(
            user_email, verified_did, display_name=display_name, verkey=verkey
        )

    def update_issuer(self, issuer_def):
        """
        Update issuer record if exists, otherwise create.
        """
        issuer_did = issuer_def.get("did")
        issuer_name = issuer_def.get("name")
        issuer_abbreviation = issuer_def.get("abbreviation")
        issuer_email = issuer_def.get("email")
        issuer_url = issuer_def.get("url")

        issuer, created = Issuer.objects.get_or_create(did=issuer_did)
        issuer.name = issuer_name
        issuer.abbreviation = issuer_abbreviation
        issuer.email = issuer_email
        issuer.url = issuer_url
        issuer.save()

        return issuer

    def update_schemas_and_ctypes(self, issuer, credential_type_defs):
        """
        Update schema records if they exist, otherwise create.
        Create related CredentialType records.
        """

        schemas = []
        credential_types = []

        for credential_type_def in credential_type_defs:
            # Get or create schema
            schema_name = credential_type_def.get("schema")
            schema_version = credential_type_def.get("version")
            schema_publisher_did = issuer.did

            schema, _ = Schema.objects.get_or_create(
                name=schema_name,
                version=schema_version,
                origin_did=schema_publisher_did,
            )
            schema.save()
            schemas.append(schema)

            # Get or create credential type
            credential_type_description = credential_type_def.get("name")
            credential_type_processor_config = {}
            credential_type_processor_config[
                "mapping"
            ] = credential_type_def.get("mapping")
            credential_type_processor_config[
                "topic"
            ] = credential_type_def.get("topic")
            credential_type_processor_config[
                "cardinality_fields"
            ] = credential_type_def.get("cardinality_fields")

            credential_type, _ = CredentialType.objects.get_or_create(
                schema=schema, issuer=issuer
            )

            credential_type.description = credential_type_description
            credential_type.processor_config = credential_type_processor_config

            credential_type.save()
            credential_types.append(credential_type)

        return schemas, credential_types
